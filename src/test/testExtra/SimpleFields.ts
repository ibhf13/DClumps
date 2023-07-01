class Fields1 {
  fieldsX = 10;
  fieldsY: number;
  fieldsString: string;

  normalMethod(): void {
    let temp = this.fieldsX + 20;
    this.fieldsY = 10 * this.fieldsX;
    this.fieldsString = "new string";
  }
}

class Fields2 {
  fieldsString = "name";
  fieldsX = 10;
  fieldsY: number;

  normalMethod(): void {
    this.fieldsX = 100;
    this.fieldsY = 50;
    this.fieldsString = this.fieldsX.toString();
  }
}
