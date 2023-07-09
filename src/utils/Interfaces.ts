export interface ParameterInfo {
  name: string;
  type: string;
  value?: string | undefined;
}

export interface ClassInfo {
  className: string;
  filepath: string;
}

export interface CallsInfo {
  callsList?: CallsList;
  callsCount: number;
}

export interface CallsList {
  callsInSame: number;
  callsGlob: GlobalCalls[];
}

export interface GlobalCalls {
  classInfo: ClassInfo;
  callsGlobCount: number;
}

export interface NewClassInfo {
  className: string;
  filepath: string;
  parameters: ParameterInfo[];
}

export interface MethodInfo {
  methodName: string;
  parameters: ParameterInfo[];
}

export interface SmellyMethods {
  methodInfo: MethodInfo;
  classInfo: ClassInfo;
  callsInfo: CallsInfo;
}

export interface FunctionInfo {
  functionFilePath: string;
  functionName: string;
  parameters: ParameterInfo[];
}

export interface SmellyFunction {
  functionInfo: FunctionInfo;
  callsList?: CallsList;
}

export interface SmellyFields {
  fieldInfo: ParameterInfo[];
  classInfo: ClassInfo;
  callsInfo?: CallsInfo;
}

export interface DataClumpsList {
  smellyMethods?: SmellyMethods[];
  smellyFunctions?: SmellyFunction[];
  smellyFieldGroup?: SmellyFields[];
}
