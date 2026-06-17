# Playwright Skill

Use this skill to generate JKAuto-compatible test automation.

## Step Keywords
- navigate-to: Navigate to a URL
- click: Click an element
- type-text: Type text into an input
- assert-text: Assert element text matches expected value
- assert-visible: Assert element is visible on page
- wait-for: Wait for element or condition
- take-screenshot: Capture a screenshot

## Test Generation Rules
1. Use data-testid locators first, fall back to CSS selectors
2. Add assertions after every significant user action
3. Include both happy path and edge cases
4. Use descriptive step names that explain user intent
5. Format object refs as: PageName.elementName