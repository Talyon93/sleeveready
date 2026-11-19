// One game in the header: a link to its page that switches game in place on a plain click.
export function GameTab(
  { label, icon, active, href, onChoose }: {
    label: string;
    icon: string;
    active: boolean;
    href: string | null;
    onChoose: () => void;
  },
)
{
  const content = (
    <>
      <span className={'game-mark ' + icon} aria-hidden="true" />
      <strong>{label}</strong>
    </>
  );
  const className = 'header-game-tab ' + (active ? 'active' : '');
  if (!href)
  {
    return (
      <button className={className} type="button" aria-pressed={active} aria-label={label} onClick={onChoose}>
        {content}
      </button>
    );
  }
  return (
    <a
      className={className}
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={event =>
      {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onChoose();
      }}
    >
      {content}
    </a>
  );
}
