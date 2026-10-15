import React from 'react'
import {
  VerticalTimeline,
  VerticalTimelineElement,
} from 'react-vertical-timeline-component';
import "react-vertical-timeline-component/style.min.css"
import SchoolIcon from "@mui/icons-material/School"
import WorkIcon from "@mui/icons-material/Work"
import "../styles/Experience.css"
import { EmojiEvents } from '@mui/icons-material';
function Experience() {
  return (
    <div className='experience'>
      <VerticalTimeline linecolor="#3e497a">
        <VerticalTimelineElement
          className="vertical-timeline-element-education"
          date="2019-2021"
          iconStyle={{ background: "#3e497a", color: "#fff" }}
          icon={<SchoolIcon />}
        >
          <h3 className="vertical-timeline-element-title">
            Nehru World School, Shastri Nagar, Ghaziabad, Uttar Pradesh
          </h3>
          <p>Class 12th CBSE </p>
        </VerticalTimelineElement>
        <VerticalTimelineElement
          className="vertical-timeline-element-education"
          date="2021-2025"
          iconStyle={{ background: "#3e497a", color: "#fff" }}
          icon={<SchoolIcon />}
        >
          <h3 className="vertical-timeline-element-title">
            Ajay Kumar Garg Engineering College, Ghaziabad, Uttar Pradesh
          </h3>
          <p>Computer Science Engineering(Artificia Inteligence and Machine Learning) </p>
        </VerticalTimelineElement>
        <VerticalTimelineElement
          className="vertical-timeline-element-education"
          date="September-2023"
          iconStyle={{ background: "#3e497a", color: "#fff" }}
          icon={<EmojiEvents />}
        >
          <h3 className="vertical-timeline-element-title">
            Geekathon 1.0 by VIT-AP
          </h3>
          <p>Advanced to the final round of the hackathon</p>
        </VerticalTimelineElement>
        <VerticalTimelineElement
          className="vertical-timeline-element-education"
          date="January 2025 - Present"
          iconStyle={{ background: "#3e497a", color: "#fff" }}
          icon={<WorkIcon />}
        >
          <h3 className="vertical-timeline-element-title">
            CodeChef
          </h3>
          <p>SDET and Learning Content Associate - Working on projects like nodejs DSA questions and flask and much more</p>
        </VerticalTimelineElement>
      </VerticalTimeline>
    </div>
  )
}

export default Experience
