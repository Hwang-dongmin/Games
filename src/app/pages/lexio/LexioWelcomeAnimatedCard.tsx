type LexioWelcomeAnimatedCardProps = {
  subtitle?: string;
  title: string;
  className?: string;
};

export default function LexioWelcomeAnimatedCard({
  subtitle,
  title,
  className = '',
}: LexioWelcomeAnimatedCardProps) {
  return (
    <div className={`lexio-welcome-card ${className}`.trim()}>
      <span className="lexio-welcome-card-ring" aria-hidden />
      <span className="lexio-welcome-card-glow" aria-hidden />

      <div className="lexio-welcome-inner">
        <span className="lexio-welcome-line lexio-welcome-line-top" aria-hidden />
        {subtitle ? (
          <p className="lexio-welcome-subtitle">{subtitle}</p>
        ) : null}
        <h2
          className={`lexio-welcome-title${subtitle ? '' : ' lexio-welcome-title--solo'}`}
        >
          <span className="lexio-welcome-title-text">{title}</span>
        </h2>
        <span
          className="lexio-welcome-line lexio-welcome-line-bottom"
          aria-hidden
        />
      </div>

      <span className="lexio-welcome-shimmer" aria-hidden />
    </div>
  );
}
