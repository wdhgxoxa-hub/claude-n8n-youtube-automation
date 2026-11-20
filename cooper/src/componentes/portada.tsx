// Ilustraciones vectoriales propias: portadas de trabajo, no fotogramas generados.
export function Portada({ title }: { title: string }) {
  const tema = /mar|marea/i.test(title)
    ? "mar"
    : /lluvia/i.test(title)
      ? "lluvia"
      : /ciudad/i.test(title)
        ? "ciudad"
        : "cielo";
  return (
    <svg
      className={`cover-art cover-${tema}`}
      viewBox="0 0 320 200"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect
        width="320"
        height="200"
        fill={
          tema === "ciudad"
            ? "#403f43"
            : tema === "lluvia"
              ? "#354e50"
              : "#354e65"
        }
      />
      {tema === "mar" ? (
        <>
          <circle cx="242" cy="49" r="25" fill="#d8ccb1" />
          <path d="M0 105Q55 65 130 112T320 96V200H0Z" fill="#547989" />
          <path d="M0 137Q60 93 155 141T320 125V200H0Z" fill="#8eaeb6" />
          <path d="M0 170Q70 129 165 171T320 155V200H0Z" fill="#c8d2cc" />
          <path d="M0 197Q65 174 139 188L192 200H0Z" fill="#cab99a" />
        </>
      ) : tema === "lluvia" ? (
        <>
          <path d="M0 167Q90 112 180 155T320 141V200H0Z" fill="#788376" />
          <path d="M0 190Q100 145 210 183T320 169V200H0Z" fill="#b1ae94" />
          {[35, 85, 135, 185, 235, 285].map((x, i) => (
            <path
              key={x}
              d={`M${x} ${22 + (i % 3) * 18}l-12 35m12 20-12 35`}
              stroke="#c3d4ce"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
          <ellipse
            cx="165"
            cy="165"
            rx="33"
            ry="8"
            fill="none"
            stroke="#d7d9c3"
            strokeWidth="2"
          />
        </>
      ) : tema === "ciudad" ? (
        <>
          <circle cx="218" cy="69" r="38" fill="#d0b99b" />
          <path
            d="M0 44H65V200H0ZM76 86H125V200H76ZM215 108H266V200H215ZM275 29H320V200H275Z"
            fill="#8b8880"
          />
          <path d="M128 200 163 117 212 200" fill="#c4b7a3" />
          {[15, 37, 89, 230, 289].map((x) => (
            <path
              key={x}
              d={`M${x} 116v14m0 15v14m0 15v14`}
              stroke="#d4c7ac"
              strokeWidth="8"
            />
          ))}
        </>
      ) : (
        <>
          <path d="M0 83Q85 115 172 75T320 69V200H0Z" fill="#7e96a4" />
          <path d="M0 130Q108 94 199 128T320 106V200H0Z" fill="#c9ad91" />
          <circle cx="226" cy="125" r="30" fill="#e3d2aa" />
          <path
            d="M0 184 73 143 138 166 215 151 320 176V200H0Z"
            fill="#445461"
          />
        </>
      )}
      <path
        d="M16 16h14m-14 0v14m288-14h-14m14 0v14M16 184h14m-14 0v-14m288 14h-14m14 0v-14"
        stroke="#fff"
        opacity=".45"
        fill="none"
      />
    </svg>
  );
}
