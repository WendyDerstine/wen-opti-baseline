import Link from 'next/link';
import { User, Menu, ChevronDown, ArrowUpRight } from 'lucide-react';
import { siteConfig } from '@/lib/siteConfig';
import { getNavTree, type NavNode } from '@/lib/navTree';

/**
 * Sticky header: logo, primary nav, account button and call to action.
 *
 * The primary nav comes from the CMS content tree (lib/navTree.ts): the start
 * page, its child pages, and a dropdown (CSS hover / keyboard focus) for any
 * page that has children. Links that are not CMS pages go in
 * siteConfig.mainNavExtraLinks. The mobile menu is a native <details>
 * disclosure, so this stays a Server Component with no client JS.
 */
const linkClass = 'inline-flex items-center gap-1 hover:text-white transition-colors';

function DesktopItem({ node }: { node: NavNode }) {
  if (node.children.length === 0) {
    return (
      <Link href={node.href} className={linkClass}>
        {node.label}
      </Link>
    );
  }
  return (
    <div className="group relative">
      <Link href={node.href} className={linkClass} aria-haspopup="true">
        {node.label}
        <ChevronDown
          size={14}
          className="opacity-70 transition-transform group-hover:rotate-180 group-focus-within:rotate-180"
        />
      </Link>
      <div className="invisible absolute left-0 top-full z-50 pt-3 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <ul className="min-w-56 rounded-xl bg-blue-950 p-2 shadow-xl ring-1 ring-white/10">
          {node.children.map((child) => (
            <li key={child.href}>
              <Link
                href={child.href}
                className="block rounded-lg px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
              >
                {child.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MobileItem({ node, depth = 0 }: { node: NavNode; depth?: number }) {
  return (
    <>
      <Link
        href={node.href}
        style={depth ? { paddingLeft: `${1 + depth}rem` } : undefined}
        className={`block rounded-lg px-4 py-3 text-sm hover:bg-white/10 hover:text-white ${
          depth ? 'text-white/60' : 'font-medium text-white/85'
        }`}
      >
        {node.label}
      </Link>
      {node.children.map((child) => (
        <MobileItem key={child.href} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

const MainNav = async ({ locale }: { locale?: string }) => {
  const tree = await getNavTree(locale);
  const topLevel: NavNode[] = [
    ...(tree.home ? [{ label: siteConfig.homeNavLabel, href: tree.home.href, children: [] }] : []),
    ...tree.items,
  ];
  const extras = siteConfig.mainNavExtraLinks;

  return (
    <header className="sticky top-0 z-50 bg-blue-900 shadow-sm">
      <div className="container mx-auto px-4 flex justify-between items-center h-16">
        <div className="navbar-brand flex items-center" data-cms-field="brand_logo">
          <Link href="/" title="Go to home page" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={siteConfig.logoSrc} alt={siteConfig.logoAlt} className="h-14 w-auto" />
          </Link>
        </div>

        <nav className="hidden lg:flex items-center gap-8 font-medium text-white/80 text-sm">
          {topLevel.map((node) => (
            <DesktopItem key={node.href} node={node} />
          ))}
          {extras.map((link) => (
            <Link key={link.label} href={link.href} className={linkClass}>
              {link.label}
              {link.external ? <ArrowUpRight size={14} className="opacity-70" /> : null}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-white/70 font-medium text-sm hover:text-white transition-colors">
            <User size={16} />
            <span>{siteConfig.accountLabel}</span>
          </button>
          <Link
            href={siteConfig.primaryCta.href}
            className="hidden sm:inline-flex items-center px-4 py-2 bg-blue-200 text-blue-950 font-bold text-sm rounded-full hover:bg-blue-400 transition-colors"
          >
            {siteConfig.primaryCta.label}
          </Link>
          <details className="relative lg:hidden">
            <summary className="list-none cursor-pointer p-2 text-white [&::-webkit-details-marker]:hidden">
              <Menu size={22} />
              <span className="sr-only">Open menu</span>
            </summary>
            <div className="absolute right-0 mt-3 w-64 rounded-xl bg-blue-950 p-2 shadow-xl ring-1 ring-white/10">
              {topLevel.map((node) => (
                <MobileItem key={node.href} node={node} />
              ))}
              {extras.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-1 rounded-lg px-4 py-3 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white"
                >
                  {link.label}
                  {link.external ? <ArrowUpRight size={14} className="opacity-70" /> : null}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
};

export default MainNav;
