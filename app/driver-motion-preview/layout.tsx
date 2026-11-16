import { notFound } from "next/navigation";

/** Local preview only: a production build answers 404, so it never ships as a public page. */
export default function PreviewOnly({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <>{children}</>;
}
