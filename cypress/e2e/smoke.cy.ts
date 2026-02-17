describe("marketing", () => {
  it("loads landing page", () => {
    cy.visit("/");
    cy.contains("ACE NAIJA");
    cy.contains("Start learning now");
  });
});

