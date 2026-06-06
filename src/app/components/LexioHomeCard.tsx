import { Layers, Users } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { SplitModeHoverCard } from './ui/SplitModeHoverCard';
import { useTouchPrimary } from './ui/use-mobile';

const LEXIO_IMAGE =
  'https://images.unsplash.com/photo-1606503153255-59d8b8b82176?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080';

export default function LexioHomeCard() {
  const touchPrimary = useTouchPrimary();

  return (
    <SplitModeHoverCard
      touchRevealLabel="오프라인·온라인 선택 보기"
      background={
        <ImageWithFallback
          src={LEXIO_IMAGE}
          alt="렉시오"
          className="h-full w-full object-cover"
        />
      }
      overlay={
        <div className="h-full w-full bg-gradient-to-br from-purple-600 to-indigo-700" />
      }
      defaultContent={
        <>
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Layers className="h-8 w-8 text-white" />
          </div>
          <h3 className="mb-2 text-2xl font-bold text-white">렉시오</h3>
          <p className="flex-grow text-sm text-gray-200">
            AI와 오프라인 플레이, 또는 친구와 온라인 멀티플레이
          </p>
          <div className="mt-4 flex items-center font-medium text-white">
            <span>{touchPrimary ? '탭하여 모드 선택' : '플레이하기'}</span>
            <svg
              className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </>
      }
      left={{
        href: '/lexio',
        ariaLabel: '렉시오 오프라인 — AI와 플레이',
        icon: <Layers className="h-6 w-6 text-white @md:h-7 @md:w-7 @xl:h-8 @xl:w-8" />,
        title: '오프라인',
        subtitle: 'AI',
      }}
      right={{
        href: '/lexio/online',
        ariaLabel: '렉시오 온라인 — 친구와 멀티플레이',
        icon: <Users className="h-6 w-6 text-white @md:h-7 @md:w-7 @xl:h-8 @xl:w-8" />,
        title: '온라인',
        subtitle: '친구와',
      }}
    />
  );
}
