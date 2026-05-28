import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PageHeaderActions } from '../components/PageHeaderActions';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

interface Section {
  title: string;
  description: string;
}

const SECTIONS: Section[] = [
  {
    title: '1. 잊힌 책',
    description: '초판으로 단명했거나 절판되었지만 다시 읽을 가치가 있는 책',
  },
  {
    title: '2. 숨은 채널',
    description: '구독자는 적지만 내용과 선곡, 정보성이 좋은 유튜브 채널',
  },
  {
    title: '3. 숨은 영상·음악',
    description: '조회수는 낮지만 다시 소개할 가치가 있는 콘텐츠',
  },
];

const UPCOMING = [
  '운영자 큐레이션 등록',
  'AI 소개글 생성',
  '구독자 저장하기',
  '구독자 제보는 나중에 검토',
];

const YOUTUBE_DISCOVERY_PRINCIPLES = [
  '인기 채널 추천이 아니라 숨은 신생 채널 발굴',
  'YouTube API 자동 연동은 이번 작업에서 제외',
  '채널명, 영상 제목, 링크, 운영자 추천 이유 중심',
  '영상 파일, 음원 파일, 캡처 이미지 저장 금지',
  '공식 유튜브 링크 또는 임베드 중심',
  '불법 업로드 의심 채널 제외',
  '최종 공개는 운영자 승인 후 진행',
];

const DISABLED_BUTTONS = [
  '운영자 등록 준비 중',
  'AI 소개글 생성 준비 중',
  '구독자 저장 기능 준비 중',
  '최근 신생 채널 후보 수집 준비 중',
  'YouTube API 연동 준비 중',
  '운영자 검토 기능 준비 중',
];

export function MasterpieceDetectivePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDeveloper = user?.uid === DEVELOPER_UID;

  useEffect(() => {
    if (!user) return;
    if (!isDeveloper) navigate('/');
  }, [user, isDeveloper, navigate]);

  if (!user || !isDeveloper) return null;

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#FAF9F6', color: '#1A3C6E' }}>
      <PageHeaderActions onClose={() => navigate('/admin/console')} />

      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div
          className="inline-block text-xs px-2 py-1 rounded-full mb-3"
          style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
        >
          개발자 검토용 · 준비 중
        </div>
        <h1 className="text-2xl font-bold" style={{ color: '#1A3C6E' }}>
          명작탐정비서
        </h1>
        <p className="text-sm text-gray-700 mt-3 leading-relaxed">
          잊혔지만 다시 소개할 가치가 있는 책·채널·영상·음악을 찾아
          기록하고 소개하는 비서입니다.
        </p>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          현재는 개발자 검토용 껍데기 화면입니다.
          아직 저장, 제보, AI 분석, 공개 기능은 연결되어 있지 않습니다.
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {SECTIONS.map((section) => (
          <div
            key={section.title}
            className="bg-white rounded-2xl border border-gray-200 p-5"
          >
            <h3 className="font-bold text-base mb-2" style={{ color: '#1A3C6E' }}>
              {section.title}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              - {section.description}
            </p>
          </div>
        ))}

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-bold text-base mb-2" style={{ color: '#1A3C6E' }}>
            4. 향후 기능
          </h3>
          <ul className="text-sm text-gray-600 leading-relaxed space-y-1">
            {UPCOMING.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-bold text-base mb-2" style={{ color: '#1A3C6E' }}>
            5. 향후: 최근 개설된 좋은 유튜브 채널 발굴
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            명작탐정비서는 향후 최근 개설되었거나 아직 구독자 수는 적지만,
            콘텐츠 구성·정보성·선곡·해설·진정성이 뛰어난 유튜브 채널을 발굴해
            HARU 구독자에게 소개할 수 있습니다.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-2">
            단, 초기에는 자동 추천이 아니라 운영자 큐레이션 후보로만 다룹니다.
            AI는 후보를 정리하고, 최종 공개 여부는 운영자가 판단합니다.
          </p>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="font-semibold text-sm mb-2" style={{ color: '#1A3C6E' }}>
              초기 원칙
            </h4>
            <ul className="text-sm text-gray-600 leading-relaxed space-y-1">
              {YOUTUBE_DISCOVERY_PRINCIPLES.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-2 space-y-2">
          {DISABLED_BUTTONS.map((label) => (
            <button
              key={label}
              type="button"
              disabled
              className="w-full rounded-xl border border-gray-200 bg-gray-100 text-gray-400 text-sm py-3 cursor-not-allowed"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
