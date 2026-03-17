import "server-only";

export type CareerRecord = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  courses: string[];
  workplaces: string[];
  jamb_subjects: string[];
  keywords: string[];
  is_active: boolean;
};

type JambKey =
  | "health"
  | "engineering"
  | "computing"
  | "business"
  | "law"
  | "arts"
  | "social"
  | "agriculture"
  | "environment";

type Seed = {
  title: string;
  category: string;
  intro: string;
  courses: string[];
  workplaces: string[];
  jamb: JambKey;
  keywords?: string[];
};

const COMBINATIONS: Record<JambKey, string[]> = {
  health: ["Use of English", "Biology", "Chemistry", "Physics"],
  engineering: ["Use of English", "Mathematics", "Physics", "Chemistry"],
  computing: ["Use of English", "Mathematics", "Physics", "Chemistry"],
  business: ["Use of English", "Mathematics", "Economics", "Commerce"],
  law: ["Use of English", "Literature in English", "Government", "CRS/IRS"],
  arts: ["Use of English", "Literature in English", "Government", "Fine Arts"],
  social: ["Use of English", "Government", "Economics", "Literature in English"],
  agriculture: ["Use of English", "Biology", "Chemistry", "Agricultural Science"],
  environment: ["Use of English", "Mathematics", "Physics", "Geography"]
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function summarize(seed: Seed) {
  const courses = seed.courses.slice(0, 3).join(", ");
  const workplaces = seed.workplaces.slice(0, 4).join(", ");
  const skills = COMBINATIONS[seed.jamb].slice(1).join(", ");
  return [
    `${seed.title} is a strong path for students who want to ${seed.intro}.`,
    `It is one of the major university-linked careers many JAMB candidates plan for early because the route is clear and practical.`,
    `The most direct university options usually include ${courses}.`,
    `People in this field often work in ${workplaces}.`,
    `A solid background in ${skills} gives you a strong start for this profession.`,
    `The JAMB subject combination below is a reliable guide for planning toward this career.`
  ].join("\n");
}

function makeCareer(seed: Seed): CareerRecord {
  const slug = slugify(seed.title);
  return {
    id: slug,
    slug,
    title: seed.title,
    category: seed.category,
    summary: summarize(seed),
    courses: seed.courses,
    workplaces: seed.workplaces,
    jamb_subjects: COMBINATIONS[seed.jamb],
    keywords: Array.from(new Set([seed.title, seed.category, ...seed.courses, ...(seed.keywords ?? [])])),
    is_active: true
  };
}

const SEEDS: Seed[] = [
  { title: "Medical Doctor", category: "Health Sciences", intro: "diagnose and treat patients safely", courses: ["Medicine and Surgery", "MBBS"], workplaces: ["teaching hospitals", "general hospitals", "specialist clinics", "public health agencies"], jamb: "health", keywords: ["doctor", "physician"] },
  { title: "Dentist", category: "Health Sciences", intro: "protect oral health and manage dental care", courses: ["Dentistry", "Dental Surgery"], workplaces: ["dental clinics", "hospitals", "oral care centres", "private practice"], jamb: "health" },
  { title: "Pharmacist", category: "Health Sciences", intro: "dispense medicines and guide safe drug use", courses: ["Pharmacy", "Clinical Pharmacy"], workplaces: ["hospital pharmacies", "community pharmacies", "drug companies", "regulatory agencies"], jamb: "health" },
  { title: "Nurse", category: "Health Sciences", intro: "support patient recovery and daily clinical care", courses: ["Nursing", "Nursing Science"], workplaces: ["hospitals", "maternity centres", "schools", "public health programmes"], jamb: "health" },
  { title: "Medical Laboratory Scientist", category: "Health Sciences", intro: "run tests that help doctors confirm diagnosis", courses: ["Medical Laboratory Science"], workplaces: ["diagnostic laboratories", "hospitals", "research labs", "public health centres"], jamb: "health" },
  { title: "Physiotherapist", category: "Health Sciences", intro: "restore movement and physical function", courses: ["Physiotherapy"], workplaces: ["rehabilitation centres", "sports clinics", "hospitals", "wellness centres"], jamb: "health" },
  { title: "Radiographer", category: "Health Sciences", intro: "produce imaging support for diagnosis and treatment", courses: ["Radiography"], workplaces: ["radiology units", "diagnostic centres", "hospitals", "specialist clinics"], jamb: "health" },
  { title: "Optometrist", category: "Health Sciences", intro: "help people manage vision and eye care needs", courses: ["Optometry"], workplaces: ["eye clinics", "hospitals", "optical centres", "community outreach programmes"], jamb: "health" },
  { title: "Nutritionist", category: "Health Sciences", intro: "guide healthy diets and nutrition support", courses: ["Nutrition and Dietetics", "Human Nutrition"], workplaces: ["hospitals", "wellness clinics", "food companies", "community programmes"], jamb: "health" },
  { title: "Veterinary Doctor", category: "Health Sciences", intro: "care for animal health and livestock wellbeing", courses: ["Veterinary Medicine"], workplaces: ["veterinary clinics", "farms", "animal health agencies", "research institutes"], jamb: "agriculture", keywords: ["veterinarian"] },

  { title: "Civil Engineer", category: "Engineering", intro: "design roads, bridges, and durable infrastructure", courses: ["Civil Engineering", "Structural Engineering"], workplaces: ["construction firms", "consulting firms", "public works agencies", "infrastructure companies"], jamb: "engineering" },
  { title: "Mechanical Engineer", category: "Engineering", intro: "build machines and mechanical systems", courses: ["Mechanical Engineering"], workplaces: ["factories", "energy companies", "maintenance firms", "engineering consultancies"], jamb: "engineering" },
  { title: "Electrical Engineer", category: "Engineering", intro: "build and manage power systems", courses: ["Electrical Engineering", "Power Systems Engineering"], workplaces: ["power companies", "industrial plants", "telecom companies", "engineering firms"], jamb: "engineering" },
  { title: "Electronics Engineer", category: "Engineering", intro: "develop devices, circuits, and control systems", courses: ["Electrical and Electronics Engineering"], workplaces: ["electronics firms", "telecom companies", "device manufacturers", "research labs"], jamb: "engineering" },
  { title: "Chemical Engineer", category: "Engineering", intro: "turn raw materials into useful industrial products", courses: ["Chemical Engineering"], workplaces: ["manufacturing plants", "oil and gas companies", "food processing firms", "chemical plants"], jamb: "engineering" },
  { title: "Petroleum Engineer", category: "Engineering", intro: "plan drilling and energy production operations", courses: ["Petroleum Engineering"], workplaces: ["oil companies", "service companies", "energy consultancies", "regulatory agencies"], jamb: "engineering" },
  { title: "Computer Engineer", category: "Engineering", intro: "design hardware systems and embedded devices", courses: ["Computer Engineering"], workplaces: ["hardware firms", "tech companies", "telecom companies", "device labs"], jamb: "computing" },
  { title: "Agricultural Engineer", category: "Engineering", intro: "solve farm production problems with machines and systems", courses: ["Agricultural Engineering"], workplaces: ["agribusinesses", "equipment companies", "processing plants", "government projects"], jamb: "engineering" },
  { title: "Marine Engineer", category: "Engineering", intro: "maintain marine equipment and vessel systems", courses: ["Marine Engineering"], workplaces: ["shipping firms", "dockyards", "marine service companies", "offshore facilities"], jamb: "engineering" },
  { title: "Mechatronics Engineer", category: "Engineering", intro: "combine mechanics, electronics, and automation", courses: ["Mechatronics Engineering"], workplaces: ["automation companies", "factories", "robotics labs", "engineering firms"], jamb: "engineering" },
  { title: "Industrial Engineer", category: "Engineering", intro: "improve systems, operations, and productivity", courses: ["Industrial Engineering", "Production Engineering"], workplaces: ["factories", "logistics firms", "consultancies", "service operations"], jamb: "engineering" },
  { title: "Mining Engineer", category: "Engineering", intro: "plan extraction and mineral operations safely", courses: ["Mining Engineering"], workplaces: ["mining companies", "exploration firms", "regulatory agencies", "field operations"], jamb: "engineering" },

  { title: "Software Engineer", category: "Computing and Technology", intro: "build digital products people use every day", courses: ["Software Engineering", "Computer Science"], workplaces: ["software companies", "startups", "banks", "product teams"], jamb: "computing" },
  { title: "Web Developer", category: "Computing and Technology", intro: "create websites and online platforms", courses: ["Computer Science", "Software Engineering"], workplaces: ["digital agencies", "product companies", "media firms", "startups"], jamb: "computing" },
  { title: "Mobile App Developer", category: "Computing and Technology", intro: "build Android and iOS apps for users and businesses", courses: ["Computer Science", "Software Engineering"], workplaces: ["software companies", "product startups", "agencies", "innovation hubs"], jamb: "computing" },
  { title: "Data Scientist", category: "Computing and Technology", intro: "turn data into insights and models", courses: ["Data Science", "Statistics", "Computer Science"], workplaces: ["banks", "tech companies", "consultancies", "research teams"], jamb: "computing" },
  { title: "Cybersecurity Analyst", category: "Computing and Technology", intro: "protect systems, users, and data from threats", courses: ["Cybersecurity", "Computer Science"], workplaces: ["banks", "telecom companies", "security firms", "technology teams"], jamb: "computing" },
  { title: "Cloud Engineer", category: "Computing and Technology", intro: "deploy and manage cloud infrastructure", courses: ["Computer Science", "Information Technology"], workplaces: ["tech companies", "banks", "managed service providers", "enterprise IT teams"], jamb: "computing" },
  { title: "Network Engineer", category: "Computing and Technology", intro: "design and maintain reliable networks", courses: ["Computer Science", "Information Technology"], workplaces: ["telecom firms", "banks", "schools", "enterprise IT teams"], jamb: "computing" },
  { title: "Database Administrator", category: "Computing and Technology", intro: "manage data systems for speed and safety", courses: ["Computer Science", "Information Technology"], workplaces: ["banks", "software companies", "public agencies", "enterprise teams"], jamb: "computing" },
  { title: "DevOps Engineer", category: "Computing and Technology", intro: "connect software delivery with reliable deployment", courses: ["Software Engineering", "Computer Science"], workplaces: ["product companies", "startups", "cloud teams", "engineering organisations"], jamb: "computing" },
  { title: "AI Engineer", category: "Computing and Technology", intro: "build tools powered by machine learning", courses: ["Computer Science", "Artificial Intelligence", "Data Science"], workplaces: ["AI startups", "research labs", "product teams", "innovation centres"], jamb: "computing" },

  { title: "Accountant", category: "Business and Finance", intro: "manage records, reporting, and financial controls", courses: ["Accounting", "Accountancy"], workplaces: ["audit firms", "banks", "business offices", "public institutions"], jamb: "business" },
  { title: "Auditor", category: "Business and Finance", intro: "review records and test financial systems", courses: ["Accounting", "Finance"], workplaces: ["audit firms", "consulting firms", "banks", "government agencies"], jamb: "business" },
  { title: "Banker", category: "Business and Finance", intro: "deliver banking and financial services", courses: ["Banking and Finance", "Finance"], workplaces: ["commercial banks", "microfinance banks", "fintech companies", "investment firms"], jamb: "business" },
  { title: "Economist", category: "Business and Finance", intro: "study markets, policy, and resource use", courses: ["Economics", "Applied Economics"], workplaces: ["research institutes", "banks", "government ministries", "consultancies"], jamb: "social" },
  { title: "Business Administrator", category: "Business and Finance", intro: "coordinate operations and organisational planning", courses: ["Business Administration", "Management"], workplaces: ["corporate firms", "SMEs", "public agencies", "NGOs"], jamb: "business" },
  { title: "Marketing Manager", category: "Business and Finance", intro: "grow products through campaigns and customer insight", courses: ["Marketing", "Business Administration"], workplaces: ["brands", "agencies", "retail firms", "product companies"], jamb: "business" },
  { title: "Human Resource Manager", category: "Business and Finance", intro: "support hiring and people operations", courses: ["Human Resource Management", "Business Administration"], workplaces: ["corporate organisations", "consulting firms", "public institutions", "NGOs"], jamb: "business" },
  { title: "Insurance Underwriter", category: "Business and Finance", intro: "assess and price risk carefully", courses: ["Insurance", "Actuarial Science", "Finance"], workplaces: ["insurance firms", "broking firms", "consultancies", "risk teams"], jamb: "business" },
  { title: "Actuary", category: "Business and Finance", intro: "measure risk with mathematics and statistics", courses: ["Actuarial Science", "Statistics", "Mathematics"], workplaces: ["insurance firms", "pension firms", "consultancies", "financial institutions"], jamb: "business" },
  { title: "Project Manager", category: "Business and Finance", intro: "coordinate people, timelines, and budgets", courses: ["Project Management", "Business Administration"], workplaces: ["construction firms", "tech companies", "consultancies", "development organisations"], jamb: "business" },

  { title: "Lawyer", category: "Law and Public Service", intro: "interpret laws, advise clients, and represent cases", courses: ["Law", "LLB"], workplaces: ["law firms", "courts", "corporate legal teams", "public agencies"], jamb: "law" },
  { title: "Judge", category: "Law and Public Service", intro: "apply legal reasoning and decide cases fairly", courses: ["Law", "LLB"], workplaces: ["courts", "judicial bodies", "legal institutions", "public service"], jamb: "law" },
  { title: "Diplomat", category: "Law and Public Service", intro: "represent national interests in global affairs", courses: ["International Relations", "Political Science", "Law"], workplaces: ["foreign missions", "ministries", "international organisations", "policy institutes"], jamb: "social" },
  { title: "Political Analyst", category: "Law and Public Service", intro: "interpret public decisions and political trends", courses: ["Political Science", "International Relations"], workplaces: ["media houses", "policy centres", "research firms", "civil society groups"], jamb: "social" },
  { title: "Public Administrator", category: "Law and Public Service", intro: "coordinate public programmes and service delivery", courses: ["Public Administration", "Political Science"], workplaces: ["ministries", "agencies", "local government offices", "public institutions"], jamb: "social" },
  { title: "Psychologist", category: "Law and Public Service", intro: "understand behaviour, wellbeing, and human development", courses: ["Psychology", "Clinical Psychology"], workplaces: ["schools", "clinics", "NGOs", "research organisations"], jamb: "social" },
  { title: "Social Worker", category: "Law and Public Service", intro: "support vulnerable people and connect them to help", courses: ["Social Work", "Sociology"], workplaces: ["NGOs", "schools", "community projects", "public welfare agencies"], jamb: "social" },
  { title: "Sociologist", category: "Law and Public Service", intro: "study society, behaviour, and institutions", courses: ["Sociology", "Social Studies"], workplaces: ["research institutes", "NGOs", "universities", "policy teams"], jamb: "social" },
  { title: "Guidance Counsellor", category: "Law and Public Service", intro: "support young people with choices and wellbeing", courses: ["Guidance and Counselling", "Psychology"], workplaces: ["schools", "colleges", "youth programmes", "private practice"], jamb: "social" },
  { title: "Criminologist", category: "Law and Public Service", intro: "study crime, justice, and prevention systems", courses: ["Criminology", "Sociology"], workplaces: ["security agencies", "research institutes", "justice projects", "policy organisations"], jamb: "social" },

  { title: "Journalist", category: "Media and Communication", intro: "gather, verify, and report important stories", courses: ["Mass Communication", "Journalism"], workplaces: ["media houses", "digital newsrooms", "broadcast stations", "public affairs desks"], jamb: "arts" },
  { title: "Broadcaster", category: "Media and Communication", intro: "present programmes and live content to audiences", courses: ["Mass Communication", "Broadcasting"], workplaces: ["radio stations", "TV stations", "podcast studios", "media companies"], jamb: "arts" },
  { title: "Public Relations Officer", category: "Media and Communication", intro: "shape reputation and public messaging", courses: ["Public Relations", "Mass Communication"], workplaces: ["corporate organisations", "agencies", "government offices", "NGOs"], jamb: "arts" },
  { title: "Advertising Executive", category: "Media and Communication", intro: "plan campaigns that connect brands with people", courses: ["Advertising", "Mass Communication", "Marketing"], workplaces: ["advertising agencies", "media firms", "brand teams", "creative studios"], jamb: "arts" },
  { title: "Copywriter", category: "Media and Communication", intro: "write persuasive messages for products and campaigns", courses: ["English", "Mass Communication", "Creative Writing"], workplaces: ["advertising agencies", "brands", "creative studios", "digital agencies"], jamb: "arts" },
  { title: "Film Director", category: "Media and Communication", intro: "lead storytelling, visual direction, and production", courses: ["Theatre Arts", "Film Production", "Mass Communication"], workplaces: ["film studios", "production houses", "TV companies", "creative teams"], jamb: "arts" },
  { title: "Music Producer", category: "Media and Communication", intro: "shape recordings and sound direction", courses: ["Music", "Creative Arts"], workplaces: ["music studios", "creative teams", "media firms", "independent production houses"], jamb: "arts" },
  { title: "Animator", category: "Media and Communication", intro: "create visual stories for media and games", courses: ["Animation", "Fine Arts", "Creative Arts"], workplaces: ["animation studios", "gaming companies", "production teams", "edtech firms"], jamb: "arts" },
  { title: "Graphic Designer", category: "Media and Communication", intro: "communicate ideas through visual systems and layout", courses: ["Fine Arts", "Graphic Design", "Creative Arts"], workplaces: ["agencies", "media firms", "brands", "product teams"], jamb: "arts" },
  { title: "Content Strategist", category: "Media and Communication", intro: "plan digital content that informs and converts", courses: ["Mass Communication", "English", "Marketing"], workplaces: ["media companies", "product teams", "brands", "agencies"], jamb: "arts" },

  { title: "Architect", category: "Built Environment", intro: "design safe and useful buildings", courses: ["Architecture"], workplaces: ["architectural firms", "construction companies", "property developers", "public agencies"], jamb: "environment" },
  { title: "Quantity Surveyor", category: "Built Environment", intro: "estimate project costs and protect budgets", courses: ["Quantity Surveying"], workplaces: ["construction firms", "consultancies", "property companies", "government projects"], jamb: "environment" },
  { title: "Estate Surveyor and Valuer", category: "Built Environment", intro: "assess property value and manage assets", courses: ["Estate Management"], workplaces: ["estate firms", "valuation companies", "banks", "property consultancies"], jamb: "environment" },
  { title: "Urban and Regional Planner", category: "Built Environment", intro: "plan land use and city growth", courses: ["Urban and Regional Planning"], workplaces: ["planning authorities", "consultancies", "development agencies", "public institutions"], jamb: "environment" },
  { title: "Surveyor", category: "Built Environment", intro: "measure land accurately for development projects", courses: ["Surveying and Geoinformatics"], workplaces: ["survey firms", "construction companies", "mapping agencies", "public works"], jamb: "environment" },
  { title: "Geologist", category: "Built Environment", intro: "study rocks, minerals, and earth systems", courses: ["Geology", "Earth Sciences"], workplaces: ["mining companies", "oil companies", "research institutes", "field operations"], jamb: "environment" },
  { title: "Environmental Scientist", category: "Built Environment", intro: "protect ecosystems and reduce environmental risk", courses: ["Environmental Science", "Environmental Management"], workplaces: ["environmental agencies", "consultancies", "NGOs", "research institutions"], jamb: "environment" },
  { title: "Town Planner", category: "Built Environment", intro: "shape settlements and public spaces for people", courses: ["Urban and Regional Planning", "Town Planning"], workplaces: ["planning boards", "consultancies", "public agencies", "development firms"], jamb: "environment" },

  { title: "Agronomist", category: "Agriculture and Food Systems", intro: "improve crop production and farm systems", courses: ["Agronomy", "Crop Science"], workplaces: ["farms", "agribusinesses", "research institutes", "development programmes"], jamb: "agriculture" },
  { title: "Animal Scientist", category: "Agriculture and Food Systems", intro: "improve livestock production and welfare", courses: ["Animal Science", "Animal Production"], workplaces: ["farms", "feed companies", "research institutes", "agribusinesses"], jamb: "agriculture" },
  { title: "Fisheries Officer", category: "Agriculture and Food Systems", intro: "manage fish production and aquaculture systems", courses: ["Fisheries", "Aquaculture"], workplaces: ["fish farms", "marine institutes", "agribusinesses", "public agencies"], jamb: "agriculture" },
  { title: "Forester", category: "Agriculture and Food Systems", intro: "manage forests, timber, and conservation systems", courses: ["Forestry", "Forest Resources Management"], workplaces: ["forest services", "NGOs", "research institutes", "conservation projects"], jamb: "agriculture" },
  { title: "Soil Scientist", category: "Agriculture and Food Systems", intro: "study land quality and improve productivity", courses: ["Soil Science", "Agronomy"], workplaces: ["farms", "research institutes", "consultancies", "agricultural programmes"], jamb: "agriculture" },
  { title: "Food Scientist", category: "Agriculture and Food Systems", intro: "improve food quality, safety, and processing", courses: ["Food Science and Technology"], workplaces: ["food companies", "processing plants", "quality labs", "regulatory agencies"], jamb: "agriculture" },
  { title: "Crop Scientist", category: "Agriculture and Food Systems", intro: "develop better crops and cultivation systems", courses: ["Crop Science", "Agronomy"], workplaces: ["seed companies", "farms", "research institutes", "agricultural programmes"], jamb: "agriculture" },
  { title: "Agricultural Economist", category: "Agriculture and Food Systems", intro: "analyse farm markets and agricultural policy", courses: ["Agricultural Economics", "Economics"], workplaces: ["research institutes", "agribusiness firms", "development agencies", "government programmes"], jamb: "agriculture" },

  { title: "Teacher", category: "Education", intro: "guide learners and build strong academic foundations", courses: ["Education", "Educational Management"], workplaces: ["primary schools", "secondary schools", "tutorial centres", "education programmes"], jamb: "arts" },
  { title: "Mathematics Teacher", category: "Education", intro: "teach logic and problem-solving clearly", courses: ["Education Mathematics", "Mathematics Education"], workplaces: ["secondary schools", "tutorial centres", "edtech companies", "education programmes"], jamb: "engineering" },
  { title: "English Teacher", category: "Education", intro: "teach reading, grammar, and literature", courses: ["Education English", "English Education"], workplaces: ["secondary schools", "tutorial centres", "edtech companies", "teacher training programmes"], jamb: "arts" },
  { title: "Biology Teacher", category: "Education", intro: "help learners understand life science concepts", courses: ["Education Biology", "Biology Education"], workplaces: ["secondary schools", "tutorial centres", "education NGOs", "teacher training centres"], jamb: "health" },
  { title: "Economics Teacher", category: "Education", intro: "teach markets, finance, and public policy basics", courses: ["Education Economics", "Economics Education"], workplaces: ["secondary schools", "colleges", "tutorial centres", "education programmes"], jamb: "social" },
  { title: "Educational Administrator", category: "Education", intro: "manage schools and academic operations effectively", courses: ["Educational Management", "Education Administration"], workplaces: ["schools", "education boards", "NGOs", "public institutions"], jamb: "arts" },
  { title: "Special Education Teacher", category: "Education", intro: "support learners with special needs", courses: ["Special Education", "Education"], workplaces: ["special schools", "inclusive schools", "support centres", "NGOs"], jamb: "arts" },
  { title: "Early Childhood Educator", category: "Education", intro: "shape foundational learning in early years", courses: ["Early Childhood Education", "Primary Education Studies"], workplaces: ["nursery schools", "primary schools", "learning centres", "education NGOs"], jamb: "arts" }
];

export const CAREER_CATALOG: CareerRecord[] = SEEDS.map(makeCareer).sort((a, b) => a.title.localeCompare(b.title));
