"""Google Classroom API client — fetch submissions without storing student files."""
import logging
from typing import Optional
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.students",
    "https://www.googleapis.com/auth/drive.readonly",
]


class ClassroomClient:
    def __init__(self, token_data: dict):
        """Initialize with user's stored OAuth tokens."""
        creds = Credentials(
            token=token_data.get("access_token"),
            refresh_token=token_data.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=token_data.get("client_id"),
            client_secret=token_data.get("client_secret"),
            scopes=SCOPES,
        )
        self.classroom = build("classroom", "v1", credentials=creds)
        self.drive = build("drive", "v3", credentials=creds)

    def list_courses(self) -> list[dict]:
        result = self.classroom.courses().list(teacherId="me", courseStates=["ACTIVE"]).execute()
        return result.get("courses", [])

    def list_coursework(self, course_id: str) -> list[dict]:
        result = self.classroom.courses().courseWork().list(courseId=course_id).execute()
        return result.get("courseWork", [])

    def list_submissions(self, course_id: str, coursework_id: str) -> list[dict]:
        result = (
            self.classroom.courses()
            .courseWork()
            .studentSubmissions()
            .list(courseId=course_id, courseWorkId=coursework_id)
            .execute()
        )
        return result.get("studentSubmissions", [])

    def download_submission_pdf(self, file_id: str) -> Optional[bytes]:
        """Download PDF from Drive — in-memory only, not persisted."""
        try:
            request = self.drive.files().get_media(fileId=file_id)
            buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(buffer, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            return buffer.getvalue()
        except Exception as e:
            logger.error(f"Failed to download file {file_id}: {e}")
            return None
