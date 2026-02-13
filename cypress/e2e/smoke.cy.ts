describe("marketing", () => {
  it("loads landing page", () => {
    cy.visit("/");
    cy.contains("ExamForge");
    cy.contains("Get started");
  });
});

