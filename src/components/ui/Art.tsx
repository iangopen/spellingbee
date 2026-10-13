import { useId } from "react";
import type { AvatarKey } from "../../lib/avatars";
import { CLIP_ID, avatarSvg, mascotSvg, rosetteSvg } from "../../lib/beeArt";

// Decoration: every SVG here is aria-hidden. Anything that needs a name (an
// avatar next to a player) carries it on its parent, as AvatarBadge does with
// its title. The markup comes from lib/beeArt.ts, built only from constants and
// a fixed set of avatar keys, never from user input.
function Art({ svg, className }: { svg: string; className: string }) {
  const id = "art-" + useId().replace(/:/g, "");
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg.split(CLIP_ID).join(id) }} />;
}

/** A bee contestant. `size` is the box in px; the drawing fills it. */
export function AvatarArt({ avatar, size = 40 }: { avatar: AvatarKey; size?: number }) {
  return (
    <span className="art-box" style={{ width: size, height: size }}>
      <Art svg={avatarSvg(avatar)} className="art" />
    </span>
  );
}

/** The home screen's bee. It hovers 5px on a 5s loop unless motion is reduced. */
export function BeeMascot({ className = "" }: { className?: string }) {
  return <Art svg={mascotSvg()} className={`mascot ${className}`.trim()} />;
}

/** The award rosette: honey petals, a ribbon-blue tail, the bee at the centre. */
export function Rosette({ className = "" }: { className?: string }) {
  return <Art svg={rosetteSvg()} className={`rosette ${className}`.trim()} />;
}
