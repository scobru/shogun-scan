declare namespace JSX {
  interface IntrinsicElements {
    div: any;
    h2: any;
    input: any;
    button: any;
    a: any;
    p: any;
    span: any;
  }
}

declare module 'react' {
  export = React;
}

declare namespace React {
  interface CSSProperties {
    [key: string]: any;
  }
  
  interface ChangeEvent<T> {
    target: T;
  }
  
  interface HTMLInputElement {
    value: string;
  }
  
  interface FC<P> {
    (props: P): any;
  }
} 