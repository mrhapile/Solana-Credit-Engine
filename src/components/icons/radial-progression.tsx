export function RadialProgressIcon() {
  return (
    <svg
      className="recharts-surface"
      width={28}
      height={28}
      viewBox="0 0 28 28"
      style={{ width: "100%", height: "100%" }}
    >
      <title />
      <desc />

      <defs>
        <clipPath id="recharts1-clip">
          <rect x={0} y={0} width={28} height={28} />
        </clipPath>
      </defs>

      <g className="recharts-layer recharts-polar-angle-axis angleAxis">
        <path
          className="recharts-polygon angleAxis"
          fill="none"
          d="M14,0L22.228993532094623,2.6737620787507357L27.31479122813215,9.673762078750737L27.31479122813215,18.326237921249266L22.228993532094623,25.326237921249266L14,28L5.771006467905378,25.326237921249266L0.6852087718678508,18.326237921249266L0.685208771867849,9.673762078750737L5.771006467905375,2.6737620787507375L14,0Z"
        />

        <g className="recharts-layer recharts-polar-angle-axis-ticks">
          {[
            { x1: 14, y1: 0, x2: 14, y2: -8 },
            { x1: 22.2289, y1: 2.6738, x2: 26.9313, y2: -3.7984 },
            { x1: 27.3148, y1: 9.6738, x2: 34.9232, y2: 7.2016 },
            { x1: 27.3148, y1: 18.3262, x2: 34.9232, y2: 20.7984 },
            { x1: 22.229, y1: 25.3262, x2: 26.9313, y2: 31.7984 },
            { x1: 14, y1: 28, x2: 14, y2: 36 },
            { x1: 5.771, y1: 25.3262, x2: 1.0687, y2: 31.7984 },
            { x1: 0.6852, y1: 18.3262, x2: -6.9232, y2: 20.7984 },
            { x1: 0.6852, y1: 9.6738, x2: -6.9232, y2: 7.2016 },
            { x1: 5.771, y1: 2.6738, x2: 1.0687, y2: -3.7984 },
            { x1: 14, y1: 0, x2: 14, y2: -8 },
          ].map((line, i) => (
            <g key={i} className="recharts-layer recharts-polar-angle-axis-tick">
              <line className="angleAxis" fill="none" {...line} />
            </g>
          ))}
        </g>
      </g>

      <g className="recharts-layer recharts-area">
        <g className="recharts-layer recharts-radial-bar-background">
          <path
            className="recharts-sector recharts-radial-bar-background-sector"
            fill="rgba(199, 242, 132, .2)"
            d="M14,2.2
              A11.8,11.8,0,1,1,13.9998,2.2000000018
              L13.9998,4.2
              A9.8,9.8,0,1,0,14,4.2 Z"
          />
        </g>

        <g className="recharts-layer recharts-radial-bar-sectors">
          <path
            className="recharts-sector recharts-radial-bar-sector"
            fill="rgba(199, 242, 132, 1)"
            d="M14,2.2
              A11.8,11.8,0,0,1,25.1725,10.2034
              L23.2789,10.8469
              A9.8,9.8,0,0,0,14,4.2 Z"
          />
        </g>
      </g>
    </svg>
  );
}
