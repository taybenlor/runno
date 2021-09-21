// Return our buffer depending on browser or node

// @ts-ignore
import { Buffer } from "buffer-es6";

const isomorphicBuffer = Buffer;
export default isomorphicBuffer;
