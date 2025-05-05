import { cn } from "@/lib/utils";

export function RetroGrid({
  className,
  angle = 65,
}: {
  className?: string;
  angle?: number;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute w-full h-full overflow-hidden opacity-70 [perspective:200px]",
        className,
      )}
      style={{ "--grid-angle": `${angle}deg` } as React.CSSProperties}
    >
      {/* Grid */}
      <div className="absolute inset-0" style={{ transform: `rotateX(${angle}deg)` }}>
        <div
          className="animate-grid"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(0, 0, 0, 0.4) 1px, transparent 0), 
              linear-gradient(to bottom, rgba(0, 0, 0, 0.4) 1px, transparent 0)
            `,
            backgroundRepeat: 'repeat',
            backgroundSize: '60px 60px',
            height: '300vh',
            inset: '0% 0px',
            marginLeft: '-50%',
            transformOrigin: '100% 0 0',
            width: '600vw',
          }}
        />
      </div>

      {/* Background Gradient */}
      <div 
        className="absolute inset-0" 
        style={{ 
          background: 'linear-gradient(to top, white, transparent 90%)' 
        }}
      />
    </div>
  );
} 