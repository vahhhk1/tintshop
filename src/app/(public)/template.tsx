/** Re-mounts on every navigation, giving public pages a subtle fade-in transition (CSS only; no transform, so fixed layers stay fixed). */
export default function PublicTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-in fade-in duration-500 ease-out">{children}</div>;
}
