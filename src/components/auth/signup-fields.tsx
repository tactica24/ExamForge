"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { countryOptions, nigeriaStateOptions } from "@/data/location-options";

type ExamInterestOption = {
  slug: string;
  name: string;
};

function RuleItem(props: { ok: boolean; text: string }) {
  return (
    <div className={props.ok ? "text-foreground" : "text-muted-foreground"}>
      <span className="inline-flex items-center gap-1">
        <CheckCircle2 className={`h-3.5 w-3.5 ${props.ok ? "text-primary" : "text-muted-foreground/60"}`} />
        {props.text}
      </span>
    </div>
  );
}

export function SignupFields(props: { examOptions: ExamInterestOption[] }) {
  const [country, setCountry] = React.useState<string>("Nigeria");
  const [state, setState] = React.useState<string>("");
  const [selectedExams, setSelectedExams] = React.useState<string[]>([]);
  const [password, setPassword] = React.useState<string>("");
  const [confirmPassword, setConfirmPassword] = React.useState<string>("");

  const isNigeria = country === "Nigeria";
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = confirmPassword.length > 0 ? password === confirmPassword : true;
  const examCountValid = selectedExams.length >= 2 && selectedExams.length <= 3;

  const canSubmit =
    hasMinLength &&
    hasUpper &&
    hasLower &&
    hasNumber &&
    passwordsMatch &&
    examCountValid &&
    (!isNigeria || state.length > 0);

  function onCountryChange(nextCountry: string) {
    setCountry(nextCountry);
    if (nextCountry !== "Nigeria") {
      setState("");
    }
  }

  function onExamInterestsChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    const uniqueValues = Array.from(new Set(values)).slice(0, 3);
    setSelectedExams(uniqueValues);
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="surname">Surname</Label>
          <Input id="surname" name="surname" autoComplete="family-name" placeholder="Doe" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="given-name" placeholder="Jane" required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <NativeSelect id="country" name="country" value={country} onChange={(e) => onCountryChange(e.target.value)} required>
            {countryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        </div>
        {isNigeria ? (
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <NativeSelect
              id="state"
              name="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              required={isNigeria}
            >
              <option value="">Select state</option>
              {nigeriaStateOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="exam_interests">Exams interested (select 2–3)</Label>
        <NativeSelect
          id="exam_interests"
          name="exam_interests"
          multiple
          value={selectedExams}
          onChange={onExamInterestsChange}
          className="h-36"
          required
        >
          {props.examOptions.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          Selected: {selectedExams.length}/3. Choose at least 2. On desktop, use Ctrl/Cmd to select multiple.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Create password"
            minLength={8}
            pattern="(?=.*\\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
            title="Use at least 8 characters with uppercase, lowercase, and a number."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm_password">Confirm password</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {!passwordsMatch ? <p className="text-xs text-destructive">Passwords do not match.</p> : null}
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 text-xs">
        <div className="mb-2 font-medium text-foreground">Password requirements</div>
        <div className="grid gap-1">
          <RuleItem ok={hasMinLength} text="At least 8 characters" />
          <RuleItem ok={hasUpper} text="At least one uppercase letter" />
          <RuleItem ok={hasLower} text="At least one lowercase letter" />
          <RuleItem ok={hasNumber} text="At least one number" />
        </div>
      </div>

      <SubmitButton type="submit" className="w-full" pendingText="Creating..." disabled={!canSubmit}>
        Continue
      </SubmitButton>
    </>
  );
}
