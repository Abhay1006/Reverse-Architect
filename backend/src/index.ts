import { Project } from "ts-morph";
const project = new Project();

project.addSourceFilesAtPaths("src/**/*.ts");

project.getSourceFiles().forEach(sourceFile => {
    console.log(`Analyzing: ${sourceFile.getBaseName()}`);
    sourceFile.getClasses().forEach(cls => {
        console.log(`- Found Class: ${cls.getName()}`);
    });
});
