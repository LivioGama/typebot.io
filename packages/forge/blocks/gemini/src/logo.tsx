export const GeminiLogo = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient
        id="gemini-gradient-scaled"
        x1="12"
        y1="0"
        x2="12"
        y2="24"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#747EF8" />
        <stop offset="1" stopColor="#4285F4" />
      </linearGradient>
    </defs>
    {/* Group element to scale the logo down and re-center it */}
    <g transform="translate(3 3) scale(0.75)">
      <path
        d="M12 0C10.0335 5.58348 5.58348 10.0335 0 12C5.58348 13.9665 10.0335 18.4165 12 24C13.9665 18.4165 18.4165 13.9665 24 12C18.4165 10.0335 13.9665 5.58348 12 0Z"
        fill="url(#gemini-gradient-scaled)"
      />
    </g>
  </svg>
);
