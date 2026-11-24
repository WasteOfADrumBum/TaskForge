import { Button, type ButtonProps } from '@onesmall/ui';
import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * React Router's `Link`, taking `href` like an anchor so OneSmallUI components that accept a link
 * component (`SidebarItem as={RouterLink}`) can use it. Plain links in text use the base `a` style
 * (underlined, `--os-primary-text`).
 */
export const RouterLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  function RouterLink({ href = '', ...props }, ref) {
    return <Link ref={ref} to={href} {...props} />;
  },
);

const isPlainLeftClick = (event: MouseEvent<HTMLElement>) =>
  event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey;

type ButtonLinkProps = Extract<ButtonProps, { href: string }>;
export type LinkButtonProps = Omit<ButtonLinkProps, 'href'> & { to: string };

/**
 * A OneSmallUI Button that is a link, navigating client-side. @onesmall/ui 0.6.0 renders link
 * buttons as plain anchors, so this keeps the anchor (open in new tab still works) and routes
 * ordinary clicks through React Router. Recheck when 0.7.0 ships `Button as={RouterLink}`.
 */
export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(function LinkButton(
  { to, onClick, ...props },
  ref,
) {
  const navigate = useNavigate();
  return (
    <Button
      {...props}
      ref={ref}
      href={to}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || !isPlainLeftClick(event)) return;
        event.preventDefault();
        navigate(to);
      }}
    />
  );
});
