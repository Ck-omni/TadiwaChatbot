import { xDnsPrefetchControl } from "helmet";

const helmetConfig = {
    crossOriginResourcePolicy: false,
    xDnsPrefetchControl: false,
};

export default helmetConfig;