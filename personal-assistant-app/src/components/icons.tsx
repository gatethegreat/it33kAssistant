/**
 * Consistent SVG icon system — Linear-style.
 * All icons: 16px default, 1.5px stroke, currentColor, rounded caps/joins.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

// --- Navigation ---

export function BrainIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 2C5.8 2 4 3.8 4 6c0 1.2.5 2.2 1.3 3L6 10.5v1a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-1L10.7 9A4 4 0 0012 6c0-2.2-1.8-4-4-4z" />
      <path d="M6.5 13h3M7 14h2" />
    </Icon>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </Icon>
  );
}

export function AgentsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="5" r="2.5" />
      <path d="M3 13.5c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" />
    </Icon>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3.5l2.5 1.5" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 4.5v3.5l2 2" />
    </Icon>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 2L4 9h4l-1 5 5-7H8l1-5z" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 2L3 4.5v3c0 3.3 2.1 6 5 7 2.9-1 5-3.7 5-7v-3L8 2z" />
    </Icon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="2" />
      <path d="M13.3 9.7l.7.4v-4.2l-.7.4a2 2 0 01-2.6-.7l-.4-.7H9.7l-.4.7a2 2 0 01-2.6.7l-.7-.4v4.2l.7-.4a2 2 0 012.6.7l.4.7h2.6l.4-.7a2 2 0 012.6-.7z" stroke="none" />
      <path d="M6.7 2.5l-.4 1.2a1.5 1.5 0 01-1.1.9l-1.2.3v2.2l1.2.3c.5.1.9.5 1.1.9l.4 1.2h2.6l.4-1.2c.2-.4.6-.8 1.1-.9l1.2-.3V5.9l-1.2-.3a1.5 1.5 0 01-1.1-.9l-.4-1.2H6.7z" />
    </Icon>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 2h3l.3 1.3a4.5 4.5 0 011.2.7l1.3-.4 1.5 2.6-1 .9a4.5 4.5 0 010 1.4l1 .9-1.5 2.6-1.3-.4a4.5 4.5 0 01-1.2.7L9.5 14h-3l-.3-1.3a4.5 4.5 0 01-1.2-.7l-1.3.4-1.5-2.6 1-.9a4.5 4.5 0 010-1.4l-1-.9 1.5-2.6 1.3.4a4.5 4.5 0 011.2-.7L6.5 2z" />
      <circle cx="8" cy="8" r="2" />
    </Icon>
  );
}

// --- Actions ---

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3v10M3 8h10" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6l4 4 4-4" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 4l4 4-4 4" />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 4l-4 4 4 4" />
    </Icon>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Icon>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11 2.5l2.5 2.5L6 12.5H3.5V10L11 2.5z" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 4.5h10M6 4.5V3a1 1 0 011-1h2a1 1 0 011 1v1.5" />
      <path d="M4.5 4.5l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8" />
    </Icon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 7v3.5M8 5.5v0" />
    </Icon>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 13H3.5a1 1 0 01-1-1V4a1 1 0 011-1H6" />
      <path d="M10.5 11L13.5 8l-3-3M13.5 8H6" />
    </Icon>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props} fill="currentColor" stroke="none">
      <path d="M3.5 13V3L13.5 8L3.5 13z" />
    </Icon>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Icon {...props} fill="currentColor" stroke="none">
      <rect x="4" y="4" width="8" height="8" rx="1" />
    </Icon>
  );
}

export function PaperclipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.5 7.5L7.5 13.5a3.5 3.5 0 01-5-5l7-7a2.12 2.12 0 013 3l-6 6a.71.71 0 01-1-1l5-5" />
    </Icon>
  );
}

// --- Status ---

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 8.5l3 3 6-6.5" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5.5v3M8 10.5v0" />
    </Icon>
  );
}

export function DollarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 2v12M11 5.5c0-1.1-1.3-2-3-2s-3 .9-3 2 1.3 2 3 2 3 .9 3 2-1.3 2-3 2-3-.9-3-2" />
    </Icon>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 3.5h11a1 1 0 011 1v6a1 1 0 01-1 1H9l-3 2.5v-2.5H2.5a1 1 0 01-1-1v-6a1 1 0 011-1z" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 6.5a3.5 3.5 0 017 0c0 2.5 1 4 1.5 4.5H3c.5-.5 1.5-2 1.5-4.5z" />
      <path d="M6.5 11v.5a1.5 1.5 0 003 0V11" />
    </Icon>
  );
}

// --- File types ---

export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <circle cx="5.5" cy="5.5" r="1.5" />
      <path d="M2 11l3-3 2 2 3-3 4 4" />
    </Icon>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 2h5.5L13 5.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <path d="M9.5 2v4H13" />
    </Icon>
  );
}

// --- Categories (for skills browser) ---

export function PenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2.5L13.5 4 5.5 12H3.5v-2L12 2.5z" />
      <path d="M10 4.5l2 2" />
    </Icon>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="10" height="11" rx="1" />
      <path d="M6 6h1M9 6h1M6 9h1M9 9h1M7 12v2h2v-2" />
    </Icon>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 8a5.5 5.5 0 019.5-3.5M13.5 8a5.5 5.5 0 01-9.5 3.5" />
      <path d="M12 2v3h-3M4 11v3h3" />
    </Icon>
  );
}

export function FlaskIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 2h4M6.5 2v4.5L3 13a1 1 0 001 1h8a1 1 0 001-1L9.5 6.5V2" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
    </Icon>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 13V7M7 13V3M11 13V9M15 13V5" />
    </Icon>
  );
}

export function DatabaseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse cx="8" cy="4" rx="5" ry="2" />
      <path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4" />
      <path d="M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" />
    </Icon>
  );
}

export function WrenchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.5 2.5a3.5 3.5 0 00-3.8 5.7L3 12l1 1 3.8-3.7a3.5 3.5 0 005.2-3.3l-2 2-1.5-1.5 2-2z" />
    </Icon>
  );
}

export function PackageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 5L8 2l5.5 3v6L8 14l-5.5-3V5z" />
      <path d="M2.5 5L8 8l5.5-3M8 8v6" />
    </Icon>
  );
}

export function ToolIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 8.5L4.5 5H9.5L12 8.5" />
      <circle cx="7" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <path d="M4.5 6l2 2-2 2M8 10h3.5" />
    </Icon>
  );
}

export function ScheduleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M2 6.5h12M5 2v2M11 2v2" />
    </Icon>
  );
}
