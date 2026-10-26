import { ViewTransition } from "react";

/**
 * The fade between pages (the animation is in globals.css). Used by the templates, which Next gives a new key on every
 * navigation, so the old page counts as leaving and the new one as arriving. Wrapping it in a layout instead doesn't
 * work: a layout stays mounted across navigations, so nothing ever enters or exits there.
 */
export default function PageTransition({ children, enter = true }: { children: React.ReactNode; enter?: boolean }) {
  return (
    <ViewTransition enter={enter ? "page-enter" : "none"} exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
