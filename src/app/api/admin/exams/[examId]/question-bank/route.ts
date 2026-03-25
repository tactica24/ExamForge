import { createFirebaseServerClient } from "@/lib/firebase/server";
import { generateQuestionBankForSubject } from "@/lib/question-bank/pipeline";

export const runtime = "nodejs";

function normalizeSubjects(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((subject) => String(subject ?? "").trim()).filter(Boolean);
}

export async function POST(_: Request, context: { params: Promise<{ examId: string }> }) {
  const { examId } = await context.params;
  const firebase = await createFirebaseServerClient();
  const {
    data: { user }
  } = await firebase.auth.getUser();

  const isAdmin = (user?.app_metadata as any)?.role === "admin";
  if (!user || !isAdmin) {
    return Response.json({ ok: false, message: "Forbidden." }, { status: 403 });
  }

  const { data: exam } = await firebase
    .from("exams")
    .select("id,name,slug,subjects")
    .eq("id", examId)
    .maybeSingle();

  if (!exam) {
    return Response.json({ ok: false, message: "Exam not found." }, { status: 404 });
  }

  const subjects = normalizeSubjects(exam.subjects);
  if (!subjects.length) {
    return Response.json({ ok: false, message: "No subjects are configured for this exam." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      let activeSubject = "";

      try {
        write({
          type: "start",
          examId,
          examName: exam.name,
          totalSubjects: subjects.length,
          targetQuestionCount: 200
        });

        for (let index = 0; index < subjects.length; index += 1) {
          const subject = subjects[index]!;
          activeSubject = subject;
          let latestSubjectCount = 0;
          let latestTargetCount = 200;

          write({
            type: "subject_start",
            subject,
            subjectIndex: index + 1,
            totalSubjects: subjects.length
          });

          const result = await generateQuestionBankForSubject({
            examId,
            examSlug: exam.slug ?? "",
            examName: exam.name ?? "Exam",
            subject,
            focusLimit: 80,
            questionsPerFocus: 9,
            approvalThreshold: 76,
            createdBy: user.id,
            targetQuestionCount: 200,
            onProgress(progress) {
              latestSubjectCount = progress.currentSubjectCount;
              latestTargetCount = progress.targetQuestionCount ?? 200;
              write({
                type: "subject_progress",
                subjectIndex: index + 1,
                totalSubjects: subjects.length,
                ...progress
              });
            }
          });

          write({
            type: "subject_complete",
            subject,
            subjectIndex: index + 1,
            totalSubjects: subjects.length,
            currentSubjectCount: latestSubjectCount,
            targetQuestionCount: latestTargetCount,
            totalStored: result.totalStored,
            totalApproved: result.totalApproved,
            totalGenerated: result.totalGenerated
          });
        }

        write({
          type: "complete",
          totalSubjects: subjects.length
        });
      } catch (error) {
        write({
          type: "error",
          subject: activeSubject || undefined,
          message: error instanceof Error ? error.message : "Question-bank generation failed."
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
