/// <reference types="vite/client" />

// Allow importing algorithm source files as raw strings for the Code tab.
declare module '*?raw' {
  const content: string;
  export default content;
}
