// Minimal React & JSX type shims for production build type-checking

declare namespace React {
  type ReactNode = any;
  type ReactElement = any;
  type PropsWithChildren<P> = P & { children?: React.ReactNode };
  type FC<P = {}> = (props: PropsWithChildren<P>) => React.ReactElement | null;
  type ComponentType<P = {}> = FC<P>;
  interface Attributes { [key: string]: any }
  interface RefAttributes<T> { ref?: any }

  // Event types
  interface BaseSyntheticEvent<T = any, E = any, C = any> { nativeEvent: any; currentTarget: any; target: any; }
  interface SyntheticEvent<T = Element, E = Event> extends BaseSyntheticEvent<T, E, any> {}
  interface MouseEvent<T = Element> extends SyntheticEvent<T, MouseEvent> { clientX?: number; clientY?: number }
  type MouseEventHandler<T = Element> = (event: MouseEvent<T>) => void;

  // DOM attribute types
  interface HTMLAttributes<T> { children?: ReactNode; className?: string; [key: string]: any }
  interface AnchorHTMLAttributes<T> extends HTMLAttributes<T> { href?: string }
  interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> { type?: 'button' | 'submit' | 'reset' }

  // Hooks (loose signatures)
  function useState<T = any>(initial?: T | (() => T)): [T, (v: T) => void];
  function useEffect(fn: () => void | (() => void), deps?: any[]): void;
  function useCallback<T extends (...args: any[]) => any>(fn: T, deps?: any[]): T;
  function useMemo<T>(fn: () => T, deps?: any[]): T;
  function createContext<T = any>(defaultValue?: T): any;
  function useContext<T = any>(context: any): T;
  function forwardRef<T, P = any>(render: any): any;
  function useRef<T = any>(value?: T): { current: T };
  function useReducer(reducer: any, initialState: any): [any, any];
  const Fragment: any;
}

declare module 'react' {
  export = React;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props?: any, key?: any): any;
  export function jsxs(type: any, props?: any, key?: any): any;
  export function Fragment(props: any): any;
}

// Relax JSX global typing so custom UI components and Link variants compile
declare global {
  namespace JSX {
    interface Element { }
    interface IntrinsicAttributes { children?: any; [key: string]: any }
    interface IntrinsicClassAttributes<T> { }
    interface IntrinsicElements { [elemName: string]: any }
    interface ElementChildrenAttribute { children: any }
  }
}
