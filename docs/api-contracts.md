# API Contracts

## Auth
| Method | Path | Description |
|--------|------|-------------|
| GET | /auth/login | Redirect to Google OAuth |
| GET | /auth/callback?code= | Exchange code → JWT |
| GET | /auth/me | Get current user |

## Syllabus
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /upload-syllabus | multipart: file, subject_id, file_type | `{file_id, status}` |
| GET | /subjects/{id}/files | — | `{files: [...]}` |
| GET | /subjects/{id}/knowledge | — | `{graph, unit_count, topic_count}` |
| GET | /subjects/{id}/topics | ?unit_name= | `{topics: [...]}` |

## Question Papers
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /generate-paper | `{subject_id, exam_type, total_marks, ...}` | `{papers: [{paper_id, set}]}` |
| GET | /papers/{id} | — | `{...paper, questions: [...]}` |
| PATCH | /papers/{id}/questions/{qid} | `{question_text?, marks?, answer_key?}` | `{status}` |
| POST | /papers/{id}/finalize | — | `{status, paper_id}` |

## Evaluation
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /evaluate-assignment | `{class_id, google_coursework_id, answer_key, keywords, total_marks}` | `{session_id, status}` |
| GET | /evaluation/{session_id}/results | — | `{session, results, flagged_for_review}` |
| PATCH | /evaluation/{session_id}/results/{rid}/override | `{marks, feedback}` | `{status}` |

## Analytics
| Method | Path | Response |
|--------|------|----------|
| GET | /analytics/{class_id} | `{sessions: [{avg, high, low, flagged}]}` |
| GET | /analytics/{class_id}/performance | `{score_distribution, assignment_trends}` |
| GET | /analytics/{class_id}/submission-stats | `{total, on_time, late}` |

## Question Generation Config Schema
```json
{
  "subject_id": "uuid",
  "exam_type": "midterm | final | quiz",
  "total_marks": 50,
  "duration_minutes": 180,
  "selected_units": ["Normalization", "Transactions"],
  "blooms_distribution": {
    "remember": 0.2, "understand": 0.2, "apply": 0.3,
    "analyze": 0.15, "evaluate": 0.1, "create": 0.05
  },
  "generate_sets": 2
}
```

## Evaluation Result Schema
```json
{
  "student_google_id": "string",
  "marks_awarded": 8.5,
  "total_marks": 10,
  "percentage": 85.0,
  "keyword_score": 0.8,
  "semantic_score": 0.72,
  "confidence_score": 0.76,
  "needs_review": false,
  "feedback": "Good coverage of key concepts. Answer aligns well with expected content."
}
```
