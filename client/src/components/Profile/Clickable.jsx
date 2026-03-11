import { useProfile } from '../../context/ProfileContext';

/**
 * Wrap any username or avatar to make it open the profile modal on click.
 * Usage:
 *   <Clickable userId={msg.author._id}>
 *     <span className="font-bold">{msg.author.username}</span>
 *   </Clickable>
 */
export default function Clickable({ userId, children, className = '' }) {
  const ctx = useProfile();
  if (!ctx) return children;

  return (
    <span
      onClick={(e) => { e.stopPropagation(); ctx.openProfile(userId); }}
      className={`cursor-pointer hover:underline ${className}`}
    >
      {children}
    </span>
  );
}
