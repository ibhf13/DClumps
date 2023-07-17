import { FieldsWithConstructor } from "./FieldsWithConstructor";

class Field {
  fieldsY: number;
  fieldsString: string;

  constructor(fieldsY: number, fieldsString: string) {
    this.fieldsY = fieldsY;
    this.fieldsString = fieldsString;
  }

  methodTest(): void {
    let temp = this.fieldsY + 20;
    this.fieldsString = this.fieldsY.toString();
  }
}
/**
 * problem is checking the instance name
 */
class JustChecking {
  //                Argument will be updated if it has one
  field3Instance1: Field;

  method1(field3Instance2: Field) {
    //                                    Argument will be updated
    let field3Instance3: Field = new Field(1, "2");
    //      fieldsString will be updated with setter => setFieldsString("true")
    this.field3Instance1.fieldsString = "true";
    //            fieldsY will be updated with setter setFieldsY(
    field3Instance2.fieldsY =
      //        fieldsY => .getFieldsY() +    .getFieldsY()       )
      this.field3Instance1.fieldsY + field3Instance3.fieldsY;
  }
}
