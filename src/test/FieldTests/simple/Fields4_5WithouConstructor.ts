class Fields4 {
  fieldsString = "name";
  fieldBoolean1: boolean;
  fieldsY: number;
  fieldBoolean2: boolean;

  normalMethod(): void {
    this.fieldsY = 50;
    this.fieldsString = this.fieldsY.toString();
    this.fieldBoolean1 = !this.fieldBoolean2;
  }
}
class Fields5 {
  fieldBoolean1: boolean;
  fieldsX = 10;
  fieldsY: number;
  fieldBoolean2: boolean;
  fieldsString: string;

  normalMethod(): void {
    let temp = this.fieldsX + 20;
    this.fieldsY = 10 * this.fieldsX;
    this.fieldsString = "new string";
  }
}
