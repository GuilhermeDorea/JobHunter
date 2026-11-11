import type { Metadata, Viewport } from "next";
import { Barlow, Saira_Semi_Condensed } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const disp = Saira_Semi_Condensed({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-disp", display: "swap" });
const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "JobHunter", template: "%s · JobHunter" },
  description: "Vagas de estágio, trainee e júnior ranqueadas pelo seu perfil, com o porquê de cada score.",
};
export const viewport: Viewport = { themeColor: "#050506", colorScheme: "dark" };

const CONTRACT =
  "<!-- impeccable direction contract. THESIS: a timing tower for entry-level jobs; refuses the generic dark SaaS dashboard. " +
  "OWN-WORLD: near-black ground, white slanted tiles, Saira Semi Condensed caps, tyre-ring level badges, sector bars, purple only for the best score, stage-colored race board. " +
  "STORY: open, see what's new since last visit, read why each job scored, save, move it through the race. " +
  "FIRST VIEWPORT: top tabs, yellow race-control banner, ranking tower left, telemetry panel right; primary action Salvar na corrida. " +
  "FORM: F1 broadcast timing tower, candidate 1 (user pick), seed 288a9fc6. " +
  "FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. -->";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${disp.variable} ${body.variable}`}>
      <body>
        <div hidden dangerouslySetInnerHTML={{ __html: CONTRACT }} />
        {children}
      </body>
    </html>
  );
}
