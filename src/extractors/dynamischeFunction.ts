type DataType = "smellyFieldGroup" | "smellyMethods";

function isInDataClumpsList(
  name: string,
  className: string,
  type: DataType
): boolean {
  return Data_Clumps_List.some((dataClump) => {
    if (type === "smellyFieldGroup" && dataClump.smellyFieldGroup) {
      return dataClump.smellyFieldGroup.some(
        (smellyField) =>
          smellyField.fieldParameter.name === name &&
          smellyField.classInfo.className === className
      );
    }
    if (type === "smellyMethods" && dataClump.smellyMethods) {
      return dataClump.smellyMethods.some(
        (smellyMethod) =>
          smellyMethod.methodInfo.methodName === name &&
          smellyMethod.classInfo.className === className
      );
    }
    return false;
  });
}

type SmellyType = "smellyFieldGroup" | "smellyMethodGroup";

function isInSmellyGroup(
  name: string,
  className: string,
  type: SmellyType
): boolean {
  if (type === "smellyFieldGroup") {
    return smellyFieldGroup.some(
      (smellyField) =>
        smellyField.fieldParameter.name === name &&
        smellyField.classInfo.className === className
    );
  }
  if (type === "smellyMethodGroup") {
    return smellyMethodGroup.some(
      (smellyMethod) =>
        smellyMethod.methodInfo.methodName === name &&
        smellyMethod.classInfo.className === className
    );
  }
  return false;
}
