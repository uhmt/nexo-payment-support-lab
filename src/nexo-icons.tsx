import type { ReactNode, SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

function Icon({ children, size = 24, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function OverviewIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4h7v7H4zM15 4h5v4h-5zM15 12h5v8h-5zM4 15h7v5H4z" />
      <path d="M7.5 7.5h.01M17.5 16h.01" strokeWidth="2.5" />
    </Icon>
  );
}

export function OrdersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3.5h14v16l-2-1.5-2.5 1.5-2.5-1.5-2.5 1.5L7 18l-2 1.5v-16Z" />
      <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" />
    </Icon>
  );
}

export function IncidentsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 20.5 19H3.5L12 3.5Z" />
      <path d="M12 9v4.5M12 16.5h.01" strokeWidth="2.2" />
      <path d="M4.5 21h15" />
    </Icon>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12h4l2-5 3.1 10 2.3-5H21" />
      <path d="M3 5.5h18M3 18.5h18" opacity=".45" />
    </Icon>
  );
}

export function SimulatorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 3.5h6M10 3.5v5l-5.5 9.2A2.2 2.2 0 0 0 6.4 21h11.2a2.2 2.2 0 0 0 1.9-3.3L14 8.5v-5" />
      <path d="M7.3 16h9.4M10.5 12.5h.01M14 18.5h.01" strokeWidth="2" />
    </Icon>
  );
}

export function GuideIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6.5c-2.5-2-5-2.3-8-1.5v14c3-.8 5.5-.5 8 1.5 2.5-2 5-2.3 8-1.5V5c-3-.8-5.5-.5-8 1.5Z" />
      <path d="M12 6.5v14M6.5 9.5c1.2-.1 2.1.1 3 .5M14.5 10c.9-.4 1.8-.6 3-.5" />
    </Icon>
  );
}

export function ApprovedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M3.5 9.5h17M8 14l2.3 2.3L16 11" />
    </Icon>
  );
}

export function DeclinedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M3.5 9.5h17M9 12.5l5.5 4M14.5 12.5 9 16.5" />
    </Icon>
  );
}

export function DelayedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M8 6h6M5.4 8l4.8 7.8M18.6 8l-4.8 7.8" strokeDasharray="3 3" />
      <path d="M10.5 11.4 13.5 9.8" />
    </Icon>
  );
}

export function DuplicateIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="5" width="8" height="8" rx="1.5" />
      <rect x="12" y="5" width="8" height="8" rx="1.5" />
      <path d="M8 16.5v2h8v-2M8 18.5h8M8 13v3.5M16 13v3.5" />
    </Icon>
  );
}
