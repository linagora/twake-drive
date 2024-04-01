import http from "k6/http";
import { check, sleep } from "k6";
import { FormData } from "https://jslib.k6.io/formdata/0.0.2/index.js";
import { Trend } from "k6/metrics";

// Custom metric to track upload duration
let uploadDuration = new Trend("upload_duration");

export let options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 20 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    upload_duration: ["p(95)<17000"], // 95% of uploads should be faster than 500ms
  },
};

const files = [
  { path: "../assets/sample.pdf", type: "application/pdf" },
  { path: "../assets/sample.png", type: "image/png" },
];

const baseURL = `${__ENV.BACKEND}/internal/services/files/v1/companies`;

function uploadFile(filePath, fileType, JWT, companyID) {
  const url = `${baseURL}/${companyID}/files?thumbnail_sync=0`;
  const formData = new FormData();
  const randomInt = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  const fileName = `${randomInt.toString(36)}.${fileType.split("/")[1]}`; // Extract extension from MIME type
  formData.append("file", http.file(open(filePath), fileName, fileType));

  const headers = {
    Authorization: `Bearer ${JWT}`,
    "Content-Type": `multipart/form-data; boundary=${formData.boundary}`,
  };

  let uploadStartTime = new Date().getTime();
  const response = http.post(url, formData.body(), { headers });
  let uploadEndTime = new Date().getTime();

  uploadDuration.add(uploadEndTime - uploadStartTime);

  return JSON.parse(response.body);
}

export default function () {
  const JWT = __ENV.JWT; // Set JWT as an environment variable
  const companyID = __ENV.COMPANY_ID; // Set Company ID as an environment variable
  const file = files[Math.floor(Math.random() * files.length)];

  const responseBody = uploadFile(file.path, file.type, JWT, companyID);
  check(responseBody, {
    "response is successful": body => body.resource !== undefined,
    "company_id is present": body => body.resource.company_id !== undefined,
  });

  sleep(1);
}
