export const STAGES = ["ابتدائي", "إعدادي", "ثانوي"] as const;

export type Stage = (typeof STAGES)[number];

export interface Lesson {
  id: string;
  title: string;
  description: string;
  duration: string;
  emoji: string;
  gradient: string;
}

export interface Teacher {
  slug: string;
  name: string;
  subject: string;
  stage: Stage;
  bio: string;
  initials: string;
  gradient: string;
  lessons: Lesson[];
}

export const teachers: Teacher[] = [
  {
    slug: "ahmed-elsherif",
    name: "أ. أحمد الشريف",
    subject: "رياضيات",
    stage: "ثانوي",
    bio: "مدرّس رياضيات بخبرة ١٥ عاماً في تدريس المرحلة الثانوية، متخصص في التفاضل والتكامل والجبر، وساعد مئات الطلاب على التفوق في الامتحانات النهائية.",
    initials: "أش",
    gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    lessons: [
      {
        id: "calc-basics",
        title: "أساسيات التفاضل",
        description: "مقدمة شاملة في النهايات والاشتقاق مع أمثلة محلولة خطوة بخطوة.",
        duration: "٩٠ دقيقة",
        emoji: "📐",
        gradient: "linear-gradient(135deg, #818cf8, #6366f1)",
      },
      {
        id: "integration",
        title: "التكامل وتطبيقاته",
        description: "طرق التكامل المختلفة وحساب المساحات والحجوم بالتطبيق العملي.",
        duration: "٩٠ دقيقة",
        emoji: "∫",
        gradient: "linear-gradient(135deg, #a78bfa, #7c3aed)",
      },
      {
        id: "algebra-review",
        title: "مراجعة الجبر الشاملة",
        description: "مراجعة مكثفة على المصفوفات والمحددات استعداداً للامتحان النهائي.",
        duration: "١٢٠ دقيقة",
        emoji: "🧮",
        gradient: "linear-gradient(135deg, #c4b5fd, #8b5cf6)",
      },
    ],
  },
  {
    slug: "sara-abdelrahman",
    name: "أ. سارة عبد الرحمن",
    subject: "لغة عربية",
    stage: "ابتدائي",
    bio: "معلّمة لغة عربية شغوفة بتأسيس الصغار، تعتمد أساليب تفاعلية ممتعة في تعليم القراءة والكتابة والإملاء لتلاميذ المرحلة الابتدائية.",
    initials: "سع",
    gradient: "linear-gradient(135deg, #ec4899, #f43f5e)",
    lessons: [
      {
        id: "reading-foundation",
        title: "تأسيس القراءة",
        description: "تعليم الحروف والمقاطع الصوتية بطريقة القصص والألعاب التعليمية.",
        duration: "٤٥ دقيقة",
        emoji: "📖",
        gradient: "linear-gradient(135deg, #f9a8d4, #ec4899)",
      },
      {
        id: "dictation-skills",
        title: "مهارات الإملاء",
        description: "قواعد الإملاء الأساسية مع تدريبات يومية ممتعة ومسابقات.",
        duration: "٤٥ دقيقة",
        emoji: "✏️",
        gradient: "linear-gradient(135deg, #fda4af, #f43f5e)",
      },
      {
        id: "expression-writing",
        title: "التعبير الكتابي",
        description: "تنمية مهارة كتابة الجمل والفقرات القصيرة بأسلوب مبسّط.",
        duration: "٦٠ دقيقة",
        emoji: "📝",
        gradient: "linear-gradient(135deg, #fbcfe8, #db2777)",
      },
    ],
  },
  {
    slug: "mohamed-hassan",
    name: "أ. محمد حسن",
    subject: "علوم",
    stage: "إعدادي",
    bio: "مدرّس علوم يؤمن بالتعلم بالتجربة، يقدّم دروسه بتجارب عملية ومحاكاة تفاعلية تجعل الفيزياء والكيمياء والأحياء مواد محببة للطلاب.",
    initials: "مح",
    gradient: "linear-gradient(135deg, #10b981, #14b8a6)",
    lessons: [
      {
        id: "matter-states",
        title: "حالات المادة وتحولاتها",
        description: "شرح حالات المادة الثلاث والتحولات بينها مع تجارب منزلية آمنة.",
        duration: "٦٠ دقيقة",
        emoji: "🧪",
        gradient: "linear-gradient(135deg, #6ee7b7, #10b981)",
      },
      {
        id: "electricity-intro",
        title: "مقدمة في الكهرباء",
        description: "الدوائر الكهربائية البسيطة والتيار والمقاومة بالمحاكاة التفاعلية.",
        duration: "٦٠ دقيقة",
        emoji: "⚡",
        gradient: "linear-gradient(135deg, #5eead4, #14b8a6)",
      },
      {
        id: "human-body",
        title: "أجهزة جسم الإنسان",
        description: "رحلة مصوّرة داخل الجهاز الهضمي والتنفسي والدوري.",
        duration: "٧٥ دقيقة",
        emoji: "🫀",
        gradient: "linear-gradient(135deg, #99f6e4, #0d9488)",
      },
    ],
  },
  {
    slug: "fatma-elnaggar",
    name: "أ. فاطمة النجار",
    subject: "لغة إنجليزية",
    stage: "ثانوي",
    bio: "معلّمة لغة إنجليزية حاصلة على شهادة CELTA، تركّز على المحادثة والقواعد معاً، وتجهّز طلاب الثانوية لامتحانات اللغة المحلية والدولية.",
    initials: "فن",
    gradient: "linear-gradient(135deg, #f59e0b, #f97316)",
    lessons: [
      {
        id: "grammar-mastery",
        title: "إتقان القواعد",
        description: "الأزمنة والجمل الشرطية والمبني للمجهول بشرح مبسّط وتدريبات مكثفة.",
        duration: "٩٠ دقيقة",
        emoji: "📚",
        gradient: "linear-gradient(135deg, #fcd34d, #f59e0b)",
      },
      {
        id: "conversation-club",
        title: "نادي المحادثة",
        description: "جلسات محادثة تفاعلية لكسر حاجز الخوف وبناء الطلاقة في التحدث.",
        duration: "٦٠ دقيقة",
        emoji: "🗣️",
        gradient: "linear-gradient(135deg, #fdba74, #f97316)",
      },
      {
        id: "exam-writing",
        title: "كتابة المقال للامتحان",
        description: "بنية المقال والبراجراف مع نماذج إجابات حاصلة على الدرجات النهائية.",
        duration: "٧٥ دقيقة",
        emoji: "✍️",
        gradient: "linear-gradient(135deg, #fed7aa, #ea580c)",
      },
    ],
  },
  {
    slug: "khaled-mostafa",
    name: "أ. خالد مصطفى",
    subject: "دراسات اجتماعية",
    stage: "إعدادي",
    bio: "مدرّس دراسات اجتماعية يحوّل التاريخ والجغرافيا إلى قصص وخرائط تفاعلية، ويستخدم الخرائط الذهنية لتثبيت المعلومات قبل الامتحانات.",
    initials: "خم",
    gradient: "linear-gradient(135deg, #3b82f6, #06b6d4)",
    lessons: [
      {
        id: "ancient-egypt",
        title: "حضارة مصر القديمة",
        description: "رحلة عبر عصور الفراعنة بالصور والقصص والخرائط الزمنية.",
        duration: "٦٠ دقيقة",
        emoji: "🏛️",
        gradient: "linear-gradient(135deg, #93c5fd, #3b82f6)",
      },
      {
        id: "map-skills",
        title: "مهارات قراءة الخريطة",
        description: "الإحداثيات ومقياس الرسم والاتجاهات بتطبيقات عملية ممتعة.",
        duration: "٤٥ دقيقة",
        emoji: "🗺️",
        gradient: "linear-gradient(135deg, #67e8f9, #06b6d4)",
      },
      {
        id: "revision-mindmaps",
        title: "مراجعة بالخرائط الذهنية",
        description: "تلخيص المنهج كاملاً في خرائط ذهنية سهلة الحفظ والاسترجاع.",
        duration: "٩٠ دقيقة",
        emoji: "🧠",
        gradient: "linear-gradient(135deg, #a5f3fc, #0891b2)",
      },
    ],
  },
  {
    slug: "nour-elhoda",
    name: "أ. نور الهدى",
    subject: "رياضيات",
    stage: "ابتدائي",
    bio: "معلّمة رياضيات للمرحلة الابتدائية، تبسّط الأرقام والعمليات الحسابية بالألعاب والأنشطة اليدوية، وتبني أساساً قوياً يحبّب التلاميذ في المادة.",
    initials: "نه",
    gradient: "linear-gradient(135deg, #8b5cf6, #d946ef)",
    lessons: [
      {
        id: "multiplication-fun",
        title: "جدول الضرب بالمرح",
        description: "حفظ جدول الضرب بالأناشيد والألعاب التفاعلية دون ملل.",
        duration: "٤٥ دقيقة",
        emoji: "✖️",
        gradient: "linear-gradient(135deg, #c4b5fd, #8b5cf6)",
      },
      {
        id: "fractions-intro",
        title: "الكسور ببساطة",
        description: "فهم الكسور ومقارنتها باستخدام البيتزا والأشكال الملوّنة.",
        duration: "٤٥ دقيقة",
        emoji: "🍕",
        gradient: "linear-gradient(135deg, #f0abfc, #d946ef)",
      },
      {
        id: "mental-math",
        title: "الحساب الذهني",
        description: "حيل وأساليب الحساب السريع لتنمية الثقة في التعامل مع الأرقام.",
        duration: "٣٠ دقيقة",
        emoji: "💡",
        gradient: "linear-gradient(135deg, #e9d5ff, #a855f7)",
      },
    ],
  },
];

export const subjects = [...new Set(teachers.map((t) => t.subject))];

export function getTeacherBySlug(slug: string): Teacher | undefined {
  return teachers.find((t) => t.slug === slug);
}
