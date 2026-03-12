import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

const diaryData = [
  {
    date: "2026.03.01",
    day: "Sun",
    mood: "Calm",
    title: "조용하지만 기분 좋았던 하루",
    content: "오늘은 날씨가 좋아 오후에 잠깐 걸었다. 바람이 세지 않아 걷기 편했고, 집에 돌아와서는 차 한 잔 마시며 쉬었다. 특별한 일은 없었지만 마음이 조금 가벼워졌다.",
    images: [
      "https://images.unsplash.com/photo-1763308373462-55ccb16f12b1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
      "https://images.unsplash.com/photo-1619544667551-b42fa29c5b34?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
      "https://images.unsplash.com/photo-1763708953382-81721b3d0759?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
    ],
  },
  {
    date: "2026.03.02",
    day: "Mon",
    mood: "Reflective",
    title: "정리하는 시간",
    content: "오전에는 책상 위를 정리하고 점심 후에 잠깐 낮잠을 잤다. 저녁에는 가족과 식사하며 대화를 나눴다. 조용하고 안정적인 하루였다.",
    images: [
      "https://images.unsplash.com/photo-1505209487757-5114235191e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
      "https://images.unsplash.com/photo-1771161409352-bae2f33a14a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
    ],
  },
  {
    date: "2026.03.03",
    day: "Tue",
    mood: "Warm",
    title: "식물을 돌보던 날",
    content: "창가에 있는 화분에 물을 주고, 햇빛이 잘 들도록 위치를 조금 바꿨다. 작은 새싹이 올라오는 걸 보니 기분이 좋았다. 저녁에는 일찍 잠자리에 들었다.",
    images: [
      "https://images.unsplash.com/photo-1700051358666-571342d57e66?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
      "https://images.unsplash.com/photo-1642689703515-1dcf91a784a5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
      "https://images.unsplash.com/photo-1764961691150-a5bb5ffae09b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
    ],
  },
  {
    date: "2026.03.04",
    day: "Wed",
    mood: "Busy",
    title: "바쁘지만 괜찮았던 날",
    content: "오전부터 할 일이 많아 바삐 움직였다. 점심시간도 짧게 보내고 오후에는 집중해서 작업했다. 저녁에는 피곤했지만 뿌듯한 기분이 들었다.",
    images: [
      "https://images.unsplash.com/photo-1771613413936-3d8db8b9108b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
      "https://images.unsplash.com/photo-1771054934948-feff2cece732?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
    ],
  },
  {
    date: "2026.03.05",
    day: "Thu",
    mood: "Peaceful",
    title: "공원을 다녀온 날",
    content: "점심 먹고 가까운 공원에 갔다. 벤치에 앉아 잠깐 쉬면서 하늘을 바라봤다. 날씨가 흐렸지만 산책하기에는 괜찮았다. 집에 와서는 책을 조금 읽었다.",
    images: [
      "https://images.unsplash.com/photo-1696869787788-db04592343fc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
      "https://images.unsplash.com/photo-1763506392288-0705b7f487c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
      "https://images.unsplash.com/photo-1769987935945-ed7edbb056b1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
    ],
  },
  {
    date: "2026.03.06",
    day: "Fri",
    mood: "Gentle",
    title: "비 내리는 날",
    content: "아침부터 비가 왔다. 창가에 앉아 빗소리를 들으며 차를 마셨다. 외출하지 않고 집에서 조용히 시간을 보냈다. 저녁에는 간단하게 요리를 해먹었다.",
    images: [
      "https://images.unsplash.com/photo-1605488483923-a5b3ac0a1a17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
      "https://images.unsplash.com/photo-1771574206825-f8d022bd2229?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
    ],
  },
  {
    date: "2026.03.07",
    day: "Sat",
    mood: "Content",
    title: "산책과 저녁 노을",
    content: "오후에 동네를 천천히 걸었다. 햇살이 따뜻해서 기분이 좋았다. 저녁에는 창밖으로 보이는 노을이 예뻐서 한참 바라봤다. 평온한 마음으로 하루를 마무리했다.",
    images: [
      "https://images.unsplash.com/photo-1711702321436-192e31d37f34?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
      "https://images.unsplash.com/photo-1764077578199-ae327e8aad26?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
      "https://images.unsplash.com/photo-1758723076861-a1ff8d9a1ade?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
    ],
  },
];

type PageType = "cover" | "intro" | "day" | "summary";

interface Page {
  type: PageType;
  dayIndex?: number;
}

export default function DiaryViewer() {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const pages: Page[] = [
    { type: "cover" },
    { type: "intro" },
    ...diaryData.map((_, index) => ({ type: "day" as const, dayIndex: index })),
    { type: "summary" },
  ];

  const totalPages = pages.length;
  const currentPage = pages[currentPageIndex];

  const handleNext = () => {
    if (currentPageIndex < totalPages - 1) {
      setDirection(1);
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentPageIndex > 0) {
      setDirection(-1);
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const handleDownloadPDF = () => {
    alert("PDF 저장 기능은 프로토타입에서 구현됩니다.");
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? "-100%" : "100%",
      opacity: 0,
    }),
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-stone-100">
      <div className="relative w-full max-w-[390px] h-screen bg-white shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-white/95 backdrop-blur-sm border-b border-stone-200">
          <button
            onClick={() => alert("뷰어를 닫습니다.")}
            className="p-2 rounded-full hover:bg-stone-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-stone-700" />
          </button>

          <div className="text-sm text-stone-600">
            {currentPageIndex + 1} / {totalPages}
          </div>

          <button
            onClick={handleDownloadPDF}
            className="p-2 rounded-full hover:bg-stone-100 transition-colors"
            aria-label="PDF 저장"
          >
            <Download className="w-5 h-5 text-stone-700" />
          </button>
        </div>

        <div className="relative w-full h-full pt-14">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentPageIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              className="absolute inset-0 overflow-y-auto"
            >
              {currentPage.type === "cover" && <CoverPage />}
              {currentPage.type === "intro" && <IntroPage />}
              {currentPage.type === "day" && currentPage.dayIndex !== undefined && (
                <DayPage data={diaryData[currentPage.dayIndex]} />
              )}
              {currentPage.type === "summary" && <SummaryPage />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-4 bg-gradient-to-t from-white via-white to-transparent">
          <button
            onClick={handlePrev}
            disabled={currentPageIndex === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-full bg-stone-800 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-stone-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm">이전</span>
          </button>

          <button
            onClick={handleNext}
            disabled={currentPageIndex === totalPages - 1}
            className="flex items-center gap-1 px-4 py-2 rounded-full bg-stone-800 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-stone-700 transition-colors"
          >
            <span className="text-sm">다음</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="absolute top-14 left-0 bottom-20 w-20 z-10" onClick={handlePrev} />
        <div className="absolute top-14 right-0 bottom-20 w-20 z-10" onClick={handleNext} />
      </div>
    </div>
  );
}

function CoverPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 bg-gradient-to-br from-stone-50 to-stone-100">
      <div className="text-center space-y-6">
        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-stone-200 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-stone-300" />
        </div>
        <h1 className="text-3xl text-stone-900">7일 합본 일기</h1>
        <p className="text-lg text-stone-600">2026.03.01 - 2026.03.07</p>
        <p className="text-sm text-stone-500 italic">7 days of quiet daily records</p>
        <div className="mt-8 pt-8 border-t border-stone-300 text-stone-600 space-y-1">
          <p className="text-sm">기록 수: 7개</p>
          <p className="text-sm">사진 수: 18장</p>
        </div>
      </div>
    </div>
  );
}

function IntroPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="space-y-8">
        <div className="space-y-4">
          <h2 className="text-xl text-stone-900">조용한 일상 속에서</h2>
          <p className="text-stone-700 leading-relaxed">
            작은 장면들이 차곡차곡 쌓인<br />7일의 기록
          </p>
        </div>
        <div className="pt-8 space-y-3 text-sm text-stone-600">
          <p>좌우로 넘겨 읽어보세요</p>
          <p className="text-xs text-stone-500">
            마음에 드신다면<br />우측 상단의 저장 버튼으로 PDF를 다운로드할 수 있습니다
          </p>
        </div>
      </div>
    </div>
  );
}

function DayPage({ data }: { data: (typeof diaryData)[0] }) {
  return (
    <div className="h-full px-6 py-6 overflow-y-auto">
      <div className="max-w-md mx-auto space-y-6">
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl text-stone-900">{data.date}</span>
            <span className="text-lg text-stone-500">{data.day}</span>
          </div>
          <div className="inline-block px-3 py-1 text-xs rounded-full bg-stone-100 text-stone-700">
            {data.mood}
          </div>
        </div>
        <h3 className="text-lg text-stone-900">{data.title}</h3>
        <p className="text-stone-700 leading-relaxed">{data.content}</p>
        <div className="space-y-3">
          {data.images.length === 1 && (
            <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-stone-100">
              <ImageWithFallback src={data.images[0]} alt="일기 사진" className="w-full h-full object-cover" />
            </div>
          )}
          {data.images.length === 2 && (
            <div className="grid grid-cols-2 gap-3">
              {data.images.map((img, idx) => (
                <div key={idx} className="w-full aspect-square rounded-lg overflow-hidden bg-stone-100">
                  <ImageWithFallback src={img} alt={`일기 사진 ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
          {data.images.length === 3 && (
            <div className="space-y-3">
              <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-stone-100">
                <ImageWithFallback src={data.images[0]} alt="대표 사진" className="w-full h-full object-cover" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {data.images.slice(1).map((img, idx) => (
                  <div key={idx} className="w-full aspect-square rounded-lg overflow-hidden bg-stone-100">
                    <ImageWithFallback src={img} alt={`일기 사진 ${idx + 2}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="space-y-8">
        <div className="space-y-4">
          <h2 className="text-xl text-stone-900">이번 주 요약</h2>
          <p className="text-stone-700 leading-relaxed">
            특별한 사건 없이도 채워진 한 주.<br />
            작은 순간들이 모여<br />
            조용한 일상이 되었다.<br /><br />
            그것만으로도 충분했던 7일.
          </p>
        </div>
        <div className="pt-8 text-sm text-stone-600">
          <p>이 기록을 저장하시겠습니까?</p>
          <button
            onClick={() => alert("PDF 저장 기능은 프로토타입에서 구현됩니다.")}
            className="mt-4 px-6 py-3 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors"
          >
            PDF로 저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
