function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create Users Sheet
  let usersSheet = ss.getSheetByName("Users");
  if (!usersSheet) {
    usersSheet = ss.insertSheet("Users");
    usersSheet.appendRow(["id", "name", "username", "password", "role", "totalLeaves"]);
    // Insert Mock Users
    usersSheet.appendRow(["1", "John Doe", "john", "123", "employee", "20"]);
    usersSheet.appendRow(["2", "Jane Smith", "jane", "123", "employee", "20"]);
    usersSheet.appendRow(["3", "Admin Manager", "admin", "123", "manager", ""]);
    
    // Auto-resize columns
    usersSheet.autoResizeColumns(1, 6);
  }

  // Create Leaves Sheet
  let leavesSheet = ss.getSheetByName("Leaves");
  if (!leavesSheet) {
    leavesSheet = ss.insertSheet("Leaves");
    leavesSheet.appendRow(["id", "employeeId", "employeeName", "type", "startDate", "endDate", "days", "reason", "status", "appliedOn"]);
    leavesSheet.autoResizeColumns(1, 10);
  }
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Fetch Users
  const usersSheet = ss.getSheetByName("Users");
  let users = [];
  if (usersSheet) {
    const usersData = usersSheet.getDataRange().getValues();
    if (usersData.length > 1) {
      const uHeaders = usersData[0];
      for (let i = 1; i < usersData.length; i++) {
          let obj = {};
          for (let j = 0; j < uHeaders.length; j++) {
              obj[uHeaders[j]] = usersData[i][j];
          }
          users.push(obj);
      }
    }
  }

  // Fetch Leaves
  const leavesSheet = ss.getSheetByName("Leaves");
  let leaves = [];
  if (leavesSheet) {
    const leavesData = leavesSheet.getDataRange().getValues();
    if (leavesData.length > 1) {
      const lHeaders = leavesData[0];
      for (let i = 1; i < leavesData.length; i++) {
          let obj = {};
          for (let j = 0; j < lHeaders.length; j++) {
              obj[lHeaders[j]] = leavesData[i][j];
          }
          leaves.push(obj);
      }
    }
  }

  // Output JSON
  return ContentService.createTextOutput(JSON.stringify({ users, leaves }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    // Parse the incoming stringified JSON from plain text body
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const leavesSheet = ss.getSheetByName("Leaves");
    
    // Add New Leave Request
    if (payload.action === 'addLeave') {
      const l = payload.data;
      leavesSheet.appendRow([
        l.id, l.employeeId, l.employeeName, l.type, 
        l.startDate, l.endDate, l.days, l.reason, 
        l.status, l.appliedOn
      ]);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Approve/Reject Leave Request
    if (payload.action === 'updateLeaveStatus') {
      const data = leavesSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        // Find row by Leave ID
        if (data[i][0] == payload.leaveId) { 
          // Column 9 is 'status' (i+1 because 1-indexed in Sheets)
          leavesSheet.getRange(i + 1, 9).setValue(payload.status);
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Unknown action" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
