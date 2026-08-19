import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GestUniv",
  description: "Plateforme de gestion universitaire",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce CSP posé par requête dans src/proxy.ts (Content-Security-Policy :
  // script-src 'nonce-...') : nécessaire pour que CE script inline reste
  // autorisé sans affaiblir script-src avec 'unsafe-inline'. Absent hors du
  // périmètre couvert par le proxy (ne devrait pas arriver en pratique, le
  // matcher couvre tout sauf les assets statiques) → script simplement bloqué
  // par le navigateur plutôt que de planter le rendu.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Applique le thème AVANT le paint pour éviter tout flash.
            Défaut = sombre (identité du produit) ; clair uniquement si choisi. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('gestuniv-theme');if(t!=='light'){document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
        <ThemeToggle />
      </body>
    </html>
  );
}
