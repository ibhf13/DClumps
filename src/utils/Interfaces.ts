export interface MethodInfo {
  methodName: string;
  parameters: ParameterInfo[];
}

export interface ParameterInfo {
  name: string;
  type: string;
  value?: string | undefined;
}

export interface ClassInfo {
  className: string;
  filepath: string;
}

export interface NewClassInfo {
  className: string;
  filepath: string;
}

export interface SmellyMethods {
  methodInfo: MethodInfo;
  classInfo: ClassInfo;
  callsList?: CallsList;
  callsCount?: number;
}

export interface CallsList {
  callsInSame: number;
  callsGlob: GlobalCalls[];
}

export interface GlobalCalls {
  classInfo: ClassInfo;
  callsGlobCount: number;
}

export interface FunctionInfo {
  functionFilePath: string;
  functionName: string;
  parameters: ParameterInfo[];
}

export interface FunctionCalls {
  callsInSame: number;
  callsGlob: FunctionGlobalCalls[];
}

export interface FunctionGlobalCalls {
  filePath: string;
  callsGlobCount: number;
}

export interface SmellyFunction {
  functionInfo: FunctionInfo;
  callsList: FunctionCalls;
  callsCount: number;
}
export interface DataClumpsList {
  smellyMethods?: SmellyMethods[];
  smellyFunctions?: SmellyFunction[];
}
