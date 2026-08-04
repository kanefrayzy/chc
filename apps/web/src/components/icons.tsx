import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps): IconProps {
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  };
}

export function HomeIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

export function RouletteIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}

export function DiceIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CaseIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M3 10h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z" />
      <path d="M3 10V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2" />
      <path d="M12 6v15" />
      <path d="M9 13h6" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v6a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3v3a3 3 0 0 1-3 3M7 5H4v3a3 3 0 0 0 3 3" />
    </svg>
  );
}

export function UsersIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function UserIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function GiftIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M20 12v9H4v-9" />
      <path d="M2 7h20v5H2z" />
      <path d="M12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7Z" />
      <path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z" />
    </svg>
  );
}

export function ChatIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
    </svg>
  );
}

export function HeadsetIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M4 14v-2a8 8 0 1 1 16 0v2" />
      <path d="M20 14v3a3 3 0 0 1-3 3h-1v-7h1a3 3 0 0 1 3 3v-2Z" />
      <path d="M4 14v3a3 3 0 0 0 3 3h1v-7H7a3 3 0 0 0-3 3v-2Z" />
    </svg>
  );
}

export function QuestionIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.5.9-1.5 1.8V14" />
      <circle cx="12" cy="17" r=".6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WalletIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M3 7a2 2 0 0 1 2-2h13l3 3v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <path d="M16 12.5h3" />
      <path d="M3 9h15" />
    </svg>
  );
}

export function GamepadIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M6 8h12a4 4 0 0 1 4 4v3a3 3 0 0 1-5.4 1.8L15 15H9l-1.6 1.8A3 3 0 0 1 2 15v-3a4 4 0 0 1 4-4Z" />
      <path d="M8 12v3M6.5 13.5h3" />
      <circle cx="16" cy="12.5" r=".8" fill="currentColor" stroke="none" />
      <circle cx="18" cy="14.5" r=".8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M12 3 4 6v6c0 5 3.5 8.3 8 9 4.5-.7 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function BoltIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

export function LockIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CrownIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="m3 8 4 4 5-7 5 7 4-4-1.5 12H4.5L3 8Z" />
      <path d="M4.5 20h15" />
    </svg>
  );
}

export function TicketIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V9Z" />
      <path d="M14 7v10" strokeDasharray="2 2" />
    </svg>
  );
}

/** Скретч-карта: сетка «три в ряд» с отогнутым уголком покрытия. */
export function ScratchCardIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h3M14 9h3M7 13h3M14 13h3M7 17h10" />
      <path d="M17 4l4 4" />
    </svg>
  );
}

/** Пачка кодов: карточка с ключом-номиналом. */
export function CodeCardIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 12h4M14 12h4" />
      <circle cx="12" cy="12" r="1.6" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function ArrowDownIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </svg>
  );
}

export function ArrowUpIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </svg>
  );
}

export function CloseIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function MenuIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function SendIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
      <path d="m22 2-11 11" />
    </svg>
  );
}

export function VolumeIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M16 9a4 4 0 0 1 0 6" />
      <path d="M19 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

export function VolumeMutedIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="m16 9 5 6M21 9l-5 6" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function GlobeIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

export function TelegramIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base({ ...props, strokeWidth: 1.5 })}>
      <path d="M21.7 3.3 2.9 10.5c-1.1.4-1.1 1.5-.2 1.8l4.7 1.5 1.8 5.6c.2.6.4.9.9.9.3 0 .5-.1.7-.4l2.5-2.4 4.9 3.6c.9.5 1.5.2 1.7-.8L22.9 5c.3-1.3-.5-1.9-1.2-1.7Z" />
      <path d="m7.5 13.7 8.5-5.4-7.4 6.6" />
    </svg>
  );
}

export function InstagramIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base({ ...props, strokeWidth: 1.5 })}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DiscordIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base({ ...props, strokeWidth: 1.5 })}>
      <path d="M7 8a14 14 0 0 1 4-1l.5 1a11 11 0 0 1 4 0l.5-1a14 14 0 0 1 4 1c2 3 2.5 7 2 11-1.5 1-3 1.7-4.5 2L17 19c-1.5.5-3.5.5-5 .5s-3.5 0-5-.5l-.5 1.1c-1.5-.3-3-1-4.5-2-.5-4 0-8 2-11Z" />
      <circle cx="9.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CheckCircleIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

export function PlusIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function LogoutIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function StarIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base(props)}>
      <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9L12 3Z" />
    </svg>
  );
}
