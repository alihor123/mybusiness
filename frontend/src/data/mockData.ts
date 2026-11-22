export type UserRole = "student" | "mentor"

export type UserProfile = {
  firstName: string
  lastName: string
  email: string
  organization: string
}

export type DiagnosticQuestion = {
  id: string
  question: string
  options: string[]
  correctIndex: number
}

export type TrackStepKind = "theory" | "video" | "practice" | "final"

export type TrackStep = {
  id: string
  kind: TrackStepKind
  badge: string
  title: string
  completed: boolean
  prompt?: string
  defaultDraft?: string
  duration?: string
  transcript?: string
}

export type LearningTrack = {
  id: string
  title: string
  resultDescription: string
  cardDescription: string
  image: string
  iconKind: "idea" | "mvp" | "sales"
  recommendedLevel: number
  estimatedHours: string
  steps: TrackStep[]
}

export type Mentor = {
  id: string
  name: string
  role: string
  fullRole: string
  industry: string
  experience: string
  format: string
  about: string
  photo: string
  recommended: boolean
  contactUrl: string
}

export type ProjectStatus = "draft" | "pending_mentor" | "accompaniment"

export type ProjectTaskStatus = "completed" | "current" | "review" | "rework" | "locked"

export type ProjectFile = {
  id: string
  name: string
  size: string
}

export type ProjectTask = {
  id: string
  number: number
  title: string
  shortDescription: string
  instruction: string
  criteriaText: string
  status: ProjectTaskStatus
  answer: string
  files: ProjectFile[]
  aiFeedback: string[]
  mentorComment: string
}

export type ProjectMeeting = {
  id: string
  dateLabel: string
  format: string
  topic: string
  link: string
}

export type ProjectBrief = {
  name: string
  industry: string
  stage: string
  audience: string
  weeklyHours: string
  problem: string
  value: string
  doneSoFar: string
  mentorRequest: string
}

export type ProjectItem = {
  id: string
  shortDescription: string
  status: ProjectStatus
  mentorId: string | null
  brief: ProjectBrief
  tasks: ProjectTask[]
  meetings: ProjectMeeting[]
}

export type MentorRequest = {
  id: string
  projectId: string
  projectName: string
  authorName: string
  industry: string
  stage: string
  requestText: string
  brief: ProjectBrief
  status: "pending" | "accepted" | "rejected"
}

export const INITIAL_PROFILE: UserProfile = {
  firstName: "Иван",
  lastName: "Иванов",
  email: "ivan@mail.ru",
  organization: "Югорский государственный университет",
}

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: "q1",
    question: "Вы хотите открыть небольшую кофейню рядом с университетом. С чего лучше начать проверку идеи?",
    options: [
      "Арендовать помещение",
      "Опросить друзей",
      "Поговорить с потенциальными клиентами",
      "Запустить рекламу",
    ],
    correctIndex: 2,
  },
  {
    id: "q2",
    question: "Какой вопрос на интервью с клиентом даст наиболее достоверную информацию о спросе?",
    options: [
      "Вы бы покупали кофе в нашей новой кофейне?",
      "Расскажите, как вы в последний раз покупали кофе между парами",
      "Нравится ли вам идея предзаказа кофе через приложение?",
      "Сколько вы готовы платить за капучино в будущем?",
    ],
    correctIndex: 1,
  },
  {
    id: "q3",
    question: "Что лучше всего описывает цель минимально жизнеспособного продукта (MVP)?",
    options: [
      "Сразу запустить идеальный продукт со всеми функциями",
      "Быстро и с минимальными затратами проверить ключевую гипотезу на реальных клиентах",
      "Подготовить презентацию для инвесторов без запуска продаж",
      "Заказать фирменный стиль и упаковку до общения с аудиторией",
    ],
    correctIndex: 1,
  },
  {
    id: "q4",
    question: "Как правильно сформулировать целевую аудиторию для первой проверки проекта?",
    options: [
      "Все жители города, которые любят вкусный кофе",
      "Люди от 18 до 65 лет со средним доходом",
      "Студенты конкретного корпуса, покупающие кофе на 10-минутной перемене",
      "Любой человек, который проходит мимо университета",
    ],
    correctIndex: 2,
  },
  {
    id: "q5",
    question: "На что важно опираться при выборе первого канала продаж?",
    options: [
      "На места и каналы, где ваша целевая аудитория уже ищет решение своей задачи",
      "На самый дорогой рекламный канал с максимальным охватом",
      "Только на личные знакомства основателя",
      "На случайный выбор нескольких площадок одновременно",
    ],
    correctIndex: 0,
  },
]

export const INITIAL_TRACKS: LearningTrack[] = [
  {
    id: "idea-check",
    title: "Проверка идеи",
    resultDescription: "Научитесь анализировать рынок, проверять гипотезы и оценивать востребованность идеи",
    cardDescription: "Узнайте востребована ли ваша идея, кто ваши клиенты и какие у них потребности",
    image: "/images/tracks/idea-check.svg",
    iconKind: "idea",
    recommendedLevel: 3,
    estimatedHours: "≈ 4 часа",
    steps: [
      {
        id: "idea-1",
        kind: "theory",
        badge: "Теория",
        title: "Кто ваш клиент",
        completed: true,
      },
      {
        id: "idea-2",
        kind: "video",
        badge: "Теория",
        title: "Как говорить с клиентом",
        completed: true,
        duration: "06:12",
        transcript: "В этой лекции разбираем, как провести проблемное интервью без наводящих вопросов. Вместо вопроса «вы бы купили?» просите собеседника вспомнить конкретную ситуацию из прошлого: где он покупал продукт, сколько ждал, что его раздражало и как он решает задачу сейчас. Фиксируйте точные формулировки и повторяющиеся боли.",
      },
      {
        id: "idea-3",
        kind: "practice",
        badge: "Практика",
        title: "Уточните целевую аудиторию",
        completed: true,
        prompt: "Сузьте широкую формулировку аудитории до одной конкретной группы, с которой можно поговорить уже на этой неделе.",
        defaultDraft: "Студенты ЮГУ 2–4 курса, которые покупают кофе между парами в главном корпусе.",
      },
      {
        id: "idea-4",
        kind: "theory",
        badge: "Теория",
        title: "Как отличить факт от мнения",
        completed: true,
      },
      {
        id: "idea-5",
        kind: "practice",
        badge: "Практика",
        title: "Сформулируйте вопросы интервью",
        completed: true,
        prompt: "Напишите 3 вопроса о прошлом опыте клиента, которые помогут подтвердить или опровергнуть вашу гипотезу.",
        defaultDraft: "1. Когда вы последний раз покупали кофе между парами? 2. Сколько времени заняло ожидание? 3. Что вы делали, когда очередь была слишком длинной?",
      },
      {
        id: "idea-6",
        kind: "video",
        badge: "Теория",
        title: "Разбор реальных интервью",
        completed: true,
        duration: "08:40",
        transcript: "Смотрим реальные записи коротких интервью со студентами и разбираем типичные ошибки: попытка продать идею во время разговора, закрытые вопросы и игнорирование альтернатив, которыми клиенты уже пользуются.",
      },
      {
        id: "idea-7",
        kind: "final",
        badge: "Практика",
        title: "Опишите свою идею",
        completed: false,
        prompt: "Укажите конкретного клиента, его проблему и пользу вашего решения.",
        defaultDraft: "Хочу открыть кофейню для всех. Люди любят кофе, поэтому будут покупать.",
      },
    ],
  },
  {
    id: "mvp-launch",
    title: "Запуск MVP",
    resultDescription: "Разберётесь, как сформировать MVP, протестировать решение и получить первые отзывы",
    cardDescription: "Создайте минимально жизнеспособный продукт, протестируйте его на реальных клиентах и получите обратную связь",
    image: "/images/tracks/mvp-launch.svg",
    iconKind: "mvp",
    recommendedLevel: 2,
    estimatedHours: "≈ 3 часа",
    steps: [
      {
        id: "mvp-1",
        kind: "theory",
        badge: "Теория",
        title: "Что входит в минимальный продукт",
        completed: true,
      },
      {
        id: "mvp-2",
        kind: "video",
        badge: "Теория",
        title: "Как протестировать спрос без бюджета",
        completed: false,
        duration: "07:15",
        transcript: "Показываем простые форматы MVP: предзаказ в мессенджере, тестовая витрина на один день и ручная обработка первых заявок до создания сложного приложения.",
      },
      {
        id: "mvp-3",
        kind: "final",
        badge: "Практика",
        title: "Опишите первую версию MVP",
        completed: false,
        prompt: "Опишите минимальную версию вашего решения, необходимые ресурсы и как вы поймёте, что тест прошёл успешно.",
        defaultDraft: "Чат-бот предзаказа кофе на перемене с выдачей в течение 2 минут на стойке у входа в корпус.",
      },
    ],
  },
  {
    id: "first-sales",
    title: "Первые продажи",
    resultDescription: "Освоите базовые инструменты продаж, научитесь привлекать клиентов и выстраивать первые сделки",
    cardDescription: "Настройте продажи, выберите каналы продвижения и привлеките первых клиентов",
    image: "/images/tracks/first-sales.svg",
    iconKind: "sales",
    recommendedLevel: 1,
    estimatedHours: "≈ 2 часа",
    steps: [
      {
        id: "sales-1",
        kind: "theory",
        badge: "Теория",
        title: "Как сформулировать ценностное предложение",
        completed: true,
      },
      {
        id: "sales-2",
        kind: "video",
        badge: "Теория",
        title: "Первые каналы привлечения клиентов",
        completed: false,
        duration: "05:50",
        transcript: "Разбираем, как выбрать 1–2 понятных канала, где уже находится ваша аудитория, и как замерить отклик на первое предложение.",
      },
      {
        id: "sales-3",
        kind: "final",
        badge: "Практика",
        title: "План первых продаж",
        completed: false,
        prompt: "Опишите ваше предложение, два канала привлечения клиентов и цель на первую неделю продаж.",
        defaultDraft: "Предложение: кофе по предзаказу без очереди к началу перемены. Каналы: студенческие чаты и QR-стикеры в зоне отдыха.",
      },
    ],
  },
]

export const INITIAL_MENTORS: Mentor[] = [
  {
    id: "emilia-pluchevskaya",
    name: "Эмилия Плучевская",
    role: "Кандидат экономических наук, доцент",
    fullRole: "Кандидат экономических наук, доцент, заместитель руководителя ВШЦЭ в части продвижения и внешних связей",
    industry: "Общественное питание",
    experience: "15 лет опыта",
    format: "Онлайн-встречи",
    about: "Помогаю проверить спрос и подготовить первый запуск. Разбираюсь в формате точки питания, меню, экономике и продвижении. Подскажу, как протестировать идею с минимальными затратами и выйти на первые продажи.",
    photo: "/images/mentors/mentor-1.svg",
    recommended: true,
    contactUrl: "https://max.ru",
  },
  {
    id: "svetlana-panchenkova",
    name: "Панченкова Светлана",
    role: "Предприниматель, наставник студенческих команд в акселераторах",
    fullRole: "Предприниматель, наставник студенческих команд в региональных и университетских акселераторах",
    industry: "Образование и сервисы",
    experience: "15 лет опыта",
    format: "Онлайн и очно (Югра)",
    about: "Сопровождаю начинающих предпринимателей от формулировки гипотезы до первых продаж. Помогаю подготовить интервью, рассчитать юнит-экономику и собрать обратную связь от первых клиентов.",
    photo: "/images/mentors/mentor-2.svg",
    recommended: true,
    contactUrl: "https://max.ru",
  },
  {
    id: "bill-gates",
    name: "Билл Гейтс",
    role: "Предприниматель, сооснователь Microsoft",
    fullRole: "Предприниматель, сооснователь Microsoft, эксперт по масштабированию продуктов",
    industry: "IT и технологии",
    experience: "54 года опыта",
    format: "Онлайн-встречи",
    about: "Помогаю выстраивать продуктовую стратегию, приоритизировать функции MVP и находить системные решения для роста.",
    photo: "/images/mentors/mentor-3.svg",
    recommended: true,
    contactUrl: "https://max.ru",
  },
  {
    id: "gordon-ramsay",
    name: "Гордон Рамзи",
    role: "Шеф-повар, ресторатор и телеведущий",
    fullRole: "Шеф-повар, ресторатор, эксперт по стандартам сервиса и экономике общепита",
    industry: "Общественное питание",
    experience: "28 лет опыта",
    format: "Онлайн-встречи",
    about: "Разбираю концепцию заведения, скорость обслуживания, меню и операционные процессы. Помогу убрать лишнее и сфокусироваться на качестве продукта.",
    photo: "/images/mentors/mentor-4.svg",
    recommended: false,
    contactUrl: "https://max.ru",
  },
  {
    id: "elon-musk",
    name: "Илон Маск",
    role: "Предприниматель, основатель SpaceX",
    fullRole: "Предприниматель, основатель SpaceX и Tesla, эксперт по инженерным и производственным проектам",
    industry: "Производство",
    experience: "31 год опыта",
    format: "Онлайн-встречи",
    about: "Помогаю проверять амбициозные гипотезы через быстрые итерации и оптимизацию производственных затрат.",
    photo: "/images/mentors/mentor-5.svg",
    recommended: true,
    contactUrl: "https://max.ru",
  },
  {
    id: "sam-altman",
    name: "Сэм Альтман",
    role: "Сооснователь и генеральный директор OpenAI",
    fullRole: "Сооснователь и генеральный директор OpenAI, экс-президент Y Combinator",
    industry: "IT и технологии",
    experience: "21 год опыта",
    format: "Онлайн-встречи",
    about: "Консультирую ранние стартапы по поиску product-market fit, работе с первыми пользователями и формулированию сильного предложения.",
    photo: "/images/mentors/mentor-6.svg",
    recommended: true,
    contactUrl: "https://max.ru",
  },
  {
    id: "mark-zuckerberg",
    name: "Марк Цукерберг",
    role: "Предприниматель, сооснователь Facebook",
    fullRole: "Предприниматель, сооснователь Meta, эксперт по запуску студенческих и цифровых продуктов",
    industry: "IT и технологии",
    experience: "22 года опыта",
    format: "Онлайн-встречи",
    about: "Помогаю проверять идеи на кампусной аудитории, запускать быстрые прототипы и настраивать органический рост.",
    photo: "/images/mentors/mentor-7.svg",
    recommended: true,
    contactUrl: "https://max.ru",
  },
  {
    id: "steve-jobs",
    name: "Стив Джобс",
    role: "Предприниматель, сооснователь Apple",
    fullRole: "Предприниматель, сооснователь Apple, эксперт по пользовательскому опыту и продуктовому дизайну",
    industry: "Производство",
    experience: "35 лет опыта",
    format: "Онлайн-встречи",
    about: "Помогаю сфокусироваться на главной ценности продукта, убрать всё лишнее и сделать решение по-настоящему понятным клиенту.",
    photo: "/images/mentors/mentor-8.svg",
    recommended: false,
    contactUrl: "https://max.ru",
  },
]

// Создаёт базовый план сопровождения из 5 задач для проекта.
export function createBaseTasks(): ProjectTask[] {
  return [
    {
      id: "task-1",
      number: 1,
      title: "Определить аудиторию",
      shortDescription: "Изучили, кто может быть вашим клиентом",
      instruction: "Опишите целевой сегмент, ситуацию покупки и существующие альтернативы.",
      criteriaText: "Укажите конкретную группу клиентов, ситуацию возникновения потребности и не менее двух альтернатив, которыми клиенты пользуются сейчас.",
      status: "completed",
      answer: "Целевая аудитория — студенты 1–4 курса главного корпуса ЮГУ, покупающие кофе на 10-минутной перемене. Альтернативы: вендинговый автомат в холле и кафе через дорогу.",
      files: [{ id: "f-1", name: "Сегментация_ЦА.pdf", size: "96 КБ" }],
      aiFeedback: [],
      mentorComment: "Отличная конкретная формулировка сегмента и понятные альтернативы.",
    },
    {
      id: "task-2",
      number: 2,
      title: "Провести интервью",
      shortDescription: "Поговорите с потенциальными клиентами и соберите их мнения",
      instruction: "Укажите собеседников, наблюдения и выводы.",
      criteriaText: "Проведите не менее 5 интервью со студентами о покупке кофе рядом с университетом. Выясните, как они выбирают место и с какими неудобствами сталкиваются. Опишите повторяющиеся проблемы, укажите, сколько собеседников их отметили, и приведите конкретные примеры. Сформулируйте выводы для проекта и приложите краткие записи интервью.",
      status: "current",
      answer: "Поговорил с друзьями. Всем понравилась идея кофейни.",
      files: [{ id: "f-2", name: "Черновик интервью.pdf", size: "124 КБ" }],
      aiFeedback: [
        "Уточните, относятся ли собеседники к целевой аудитории.",
        "Добавьте ответы о прошлом опыте и выводы о проблеме.",
      ],
      mentorComment: "Добавьте конкретные примеры и уточните выводы.",
    },
    {
      id: "task-3",
      number: 3,
      title: "Подготовить минимальное предложение",
      shortDescription: "Сформулируйте простой вариант продукта или услуги для проверки спроса",
      instruction: "Опишите базовый состав предложения, цену и способ получения заказа.",
      criteriaText: "Сформируйте понятное минимальное предложение для первого теста с указанием цены, формата выдачи и отличия от альтернатив.",
      status: "locked",
      answer: "",
      files: [],
      aiFeedback: [],
      mentorComment: "",
    },
    {
      id: "task-4",
      number: 4,
      title: "Проверить MVP",
      shortDescription: "Запустите тест и соберите обратную связь",
      instruction: "Опишите результаты тестового запуска и обратную связь от первых пользователей.",
      criteriaText: "Проведите тест MVP минимум на 10 клиентах, зафиксируйте конверсию в заказ и ключевые замечания.",
      status: "locked",
      answer: "",
      files: [],
      aiFeedback: [],
      mentorComment: "",
    },
    {
      id: "task-5",
      number: 5,
      title: "Первые обращения",
      shortDescription: "Начните привлекать первых клиентов",
      instruction: "Зафиксируйте первые каналы привлечения, количество обращений и выводы.",
      criteriaText: "Протестируйте минимум два канала привлечения, укажите число обращений и стоимость привлечения.",
      status: "locked",
      answer: "",
      files: [],
      aiFeedback: [],
      mentorComment: "",
    },
  ]
}

export const INITIAL_PROJECTS: ProjectItem[] = [
  {
    id: "coffee-between-classes",
    shortDescription: "Кофе по предзаказу рядом с университетом.",
    status: "draft",
    mentorId: "emilia-pluchevskaya",
    brief: {
      name: "Кофе между парами",
      industry: "Общественное питание",
      stage: "Идея",
      audience: "Студенты университета",
      weeklyHours: "4 часа",
      problem: "Очередь за кофе между парами",
      value: "Быстрая выдача по предзаказу",
      doneSoFar: "Пока подготовлена идея",
      mentorRequest: "Помощь с проверкой спроса",
    },
    tasks: createBaseTasks(),
    meetings: [
      {
        id: "m-1",
        dateLabel: "12 октября, 16:00",
        format: "Онлайн-встреча",
        topic: "Разбор результатов проблемных интервью",
        link: "https://telemost.yandex.ru",
      },
      {
        id: "m-2",
        dateLabel: "19 октября, 16:00",
        format: "Онлайн-встреча",
        topic: "Подготовка минимального предложения (MVP)",
        link: "https://telemost.yandex.ru",
      },
    ],
  },
  {
    id: "candle-workshop",
    shortDescription: "Свечи ручной работы.",
    status: "pending_mentor",
    mentorId: "svetlana-panchenkova",
    brief: {
      name: "Мастерская свечей",
      industry: "Производство",
      stage: "Идея",
      audience: "Покупатели подарков и декора для дома 20–35 лет",
      weeklyHours: "6 часов",
      problem: "Сложно найти локальные подарочные свечи с натуральным составом",
      value: "Ароматические свечи из соевого воска с локальными ароматами Югры",
      doneSoFar: "Сделаны первые 10 тестовых образцов",
      mentorRequest: "Подготовка первого предложения",
    },
    tasks: createBaseTasks(),
    meetings: [],
  },
  {
    id: "home-bakery",
    shortDescription: "Выпечка на заказ.",
    status: "accompaniment",
    mentorId: "emilia-pluchevskaya",
    brief: {
      name: "Домашняя пекарня",
      industry: "Общественное питание",
      stage: "Первые клиенты",
      audience: "Семьи и офисные команды в центре города",
      weeklyHours: "8 часов",
      problem: "Нехватка свежей домашней выпечки с доставкой к нужному времени",
      value: "Свежая выпечка по предзаказу за 2 часа с понятным составом",
      doneSoFar: "Выполнено 12 заказов через знакомых и локальный чат",
      mentorRequest: "Помощь с проверкой спроса и каналами продаж",
    },
    tasks: createBaseTasks(),
    meetings: [
      {
        id: "m-3",
        dateLabel: "12 октября, 16:00",
        format: "Онлайн-встреча",
        topic: "Разбор интервью и повторных заказов",
        link: "https://telemost.yandex.ru",
      },
    ],
  },
]

export const INITIAL_MENTOR_REQUESTS: MentorRequest[] = [
  {
    id: "req-1",
    projectId: "coffee-between-classes",
    projectName: "Кофе между парами",
    authorName: "Иван Иванов",
    industry: "Общественное питание",
    stage: "Идея",
    requestText: "Помощь с проверкой спроса",
    brief: INITIAL_PROJECTS[0].brief,
    status: "pending",
  },
  {
    id: "req-2",
    projectId: "candle-workshop",
    projectName: "Мастерская свечей",
    authorName: "Анна Смирнова",
    industry: "Производство",
    stage: "Идея",
    requestText: "Подготовка первого предложения",
    brief: INITIAL_PROJECTS[1].brief,
    status: "pending",
  },
  {
    id: "req-3",
    projectId: "home-bakery",
    projectName: "Домашняя пекарня",
    authorName: "Ольга Иванова",
    industry: "Общественное питание",
    stage: "Первые клиенты",
    requestText: "Помощь с проверкой спроса",
    brief: INITIAL_PROJECTS[2].brief,
    status: "pending",
  },
]

export const INDUSTRY_OPTIONS = [
  "Общественное питание",
  "Производство",
  "Образование и сервисы",
  "IT и технологии",
  "Розничная торговля",
  "Услуги для бизнеса",
]

export const STAGE_OPTIONS = [
  "Идея",
  "Прототип / MVP",
  "Первые клиенты",
  "Регулярные продажи",
]

export const WEEKLY_HOURS_OPTIONS = [
  "1–2 часа",
  "4 часа",
  "6 часов",
  "8 часов",
  "Более 10 часов",
]
