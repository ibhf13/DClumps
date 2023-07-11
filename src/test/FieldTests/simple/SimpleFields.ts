class Fields2 {
  fieldsString = "name";
  fieldsY: number;

  normalMethod(): void {
    this.fieldsY = 50;
    this.fieldsString = this.fieldsY.toString();
  }
}

class Fields3 {
  fieldsY: number;
  fieldsString: string;
  fieldBoolean1: Boolean = true;

  normalMethod(): void {
    let temp = this.fieldsY + 20;
    this.fieldsY = 10 * this.fieldsY;
    this.fieldsString = "new string";
  }
}
