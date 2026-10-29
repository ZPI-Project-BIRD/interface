import type { ReactNode } from "react";
import { Link } from "react-router";
import logo from "../assets/logo.png";

interface CrudPageLayoutProps {
  children: ReactNode;
  headerAction?: ReactNode;
}

function CrudPageLayout({ children, headerAction }: CrudPageLayoutProps) {
  return (
    <div className="min-h-dvh bg-[#f4f5f6]">
      <header className="border-b-4 border-[#4a8b3a] bg-[#123f5d] text-white">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-5 py-2 sm:px-7">
          <Link to="/projects" className="flex min-w-0 items-center gap-3 !text-white no-underline">
            <img src={logo} alt="BIRD" className="size-10 shrink-0 invert object-contain -mr-1" />
            <div className="min-w-0">
              <div className="text-base font-semibold tracking-wide">BIRD</div>
              <div className="hidden truncate text-xs text-white/70 sm:block">
                Building Irregularity Recognition and Detection
              </div>
            </div>
          </Link>

          {headerAction}
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] p-4 sm:p-6">{children}</main>
    </div>
  );
}

export default CrudPageLayout;
