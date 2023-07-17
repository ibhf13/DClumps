import { Fields3 } from "./Fields3";
import { FieldsWithConstructor } from "./FieldsWithConstructor";
// data clumps of 3
class Fields2 {
  fieldsY: number;
  fieldsString: string = "name";
  fieldBoolean1: boolean;
  normalMethod(): void {
    this.fieldsY = 50;
    this.fieldsString = this.fieldsY.toString();
    let obj2 = new FieldsWithConstructor(true, 2, "waaaw", false);
    obj2.fieldBoolean1 = obj2.fieldsString === obj2.fieldsY.toString();
    //------------------------------------------------------
    //------------------------------------------------------

    let fields3Instance = new Fields3(10, "TESTING", true, obj2);
    // non binary statements
    if (fields3Instance.fieldsY === fields3Instance.fieldsY + 9) {
      // non binary statements
      console.log(fields3Instance.fieldsY);
      fields3Instance.fieldBoolean1;
    }

    //geschachtelete statements
    // binary statement
    fields3Instance.fieldBoolean1 =
      // binary statement             non binary statements
      (fields3Instance.fieldsY = 19 + fields3Instance.fieldsY) ===
      // non binary statements
      fields3Instance.fieldsY;

    // binary statement for not relevant obj
    let testObj = (fields3Instance.fieldsString =
      // non binary statements (Call expression)
      fields3Instance.fieldsY.toString() + "hi");
    //------------------------------------------------------
    //------------------------------------------------------

    // let obj = new Fields22(new FieldsStringFieldsY("name", undefined), 10);
    // obj.fieldsStringFieldsYInstance.getFieldsY;
  }
}
