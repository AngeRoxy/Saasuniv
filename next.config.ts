import type { NextConfig } from "next";

// Headers de sécurité HTTP STATIQUES (mêmes valeurs sur toutes les requêtes).
// La Content-Security-Policy n'est PAS ici : elle a besoin d'un nonce généré
// par requête (scripts inline injectés par Next.js App Router à chaque rendu)
// que next.config.ts, purement statique, ne peut pas produire — elle est donc
// posée dans src/proxy.ts (seul point d'exécution avant le rendu). Voir les
// commentaires de src/proxy.ts pour le détail.
const securityHeaders = [
  {
    // Force HTTPS (y compris sous-domaines) pendant 2 ans.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Empêche le navigateur de deviner un type de contenu différent de celui déclaré.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Anti-clickjacking : personne n'a besoin de charger gestUniv en <iframe>
    // ailleurs (l'app est seulement CLIENTE d'un iframe externe, Jitsi — cf.
    // frame-ancestors 'none' côté CSP dans src/proxy.ts, cohérent).
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Limite les infos envoyées dans Referer vers des sites externes.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // camera/microphone/display-capture/fullscreen/autoplay/clipboard-write
    // sont nécessaires à la visioconférence Jitsi (iframe meet.jit.si,
    // src/components/ui/jitsi-video-call.tsx) : autorisés pour self + ce
    // seul domaine plutôt que désactivés globalement, sinon les cours en
    // ligne perdent silencieusement le son/la vidéo/le partage d'écran. Le
    // reste (jamais utilisé par l'app) est désactivé.
    key: "Permissions-Policy",
    value: [
      'camera=(self "https://meet.jit.si")',
      'microphone=(self "https://meet.jit.si")',
      'display-capture=(self "https://meet.jit.si")',
      'fullscreen=(self "https://meet.jit.si")',
      'autoplay=(self "https://meet.jit.si")',
      'clipboard-write=(self "https://meet.jit.si")',
      "geolocation=()",
      "payment=()",
      "usb=()",
      "midi=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
      "interest-cohort=()",
    ].join(", "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
