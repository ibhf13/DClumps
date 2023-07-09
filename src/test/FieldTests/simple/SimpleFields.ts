class Fields2 {
  fieldsString = "name";
  fieldsY: number;

  normalMethod(): void {
    this.fieldsY = 50;
    this.fieldsString = this.fieldsY.toString();
  }
}

class Fields3 {
  fieldsX = 10;
  fieldsY: number;
  fieldsString: string;
  fieldBoolean1: Boolean;

  normalMethod(): void {
    let temp = this.fieldsX + 20;
    this.fieldsY = 10 * this.fieldsX;
    this.fieldsString = "new string";
  }
}
