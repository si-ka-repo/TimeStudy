declare module "xlsx-populate/browser/xlsx-populate" {
  const XlsxPopulate: {
    fromDataAsync(data: ArrayBuffer): Promise<any>;
  };
  export default XlsxPopulate;
}
