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
    let objInClassFields2 = new FieldsWithConstructor(true, 2, "waaaw", false);
    objInClassFields2.fieldBoolean1 =
      objInClassFields2.fieldsString === objInClassFields2.fieldsY.toString();
    //------------------------------------------------------
    //------------------------------------------------------

    let fields3Instance = new Fields3(10, "TESTING", true);
    // non binary statements
    if (fields3Instance.fieldsY === fields3Instance.fieldsY + 9) {
      // non binary statements
      console.log(fields3Instance.fieldsY);
      fields3Instance.fieldBoolean1;
    }
    // binary statement
    fields3Instance.fieldsY = 19 + fields3Instance.fieldsY;

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

    //Call expression

    fields3Instance.fieldsY.toString();

    fields3Instance.fieldsY.toString() ===
      fields3Instance.fieldsString.valueOf();
  }
}
