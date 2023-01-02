const db = require('../../connectors/db');
const roles = require('../../constants/roles');
const { getSessionToken } = require('../../utils/session');

const getUser = async function(req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect('/');
  }

  const user = await db.select('*')
    .from('se_project.sessions')
    .where('token', sessionToken)
    .innerJoin('se_project.users', 'se_project.sessions.userId', 'se_project.users.id')
    .innerJoin('se_project.roles', 'se_project.users.roleId', 'se_project.roles.id')
    .innerJoin('se_project.faculties', 'se_project.users.facultyId', 'se_project.faculties.id')
    .first();
  
  //console.log('user =>', user)
  user.isStudent = user.roleId === roles.student;
  user.isAdmin = user.roleId === roles.admin;

  return user;  
}

module.exports = function(app) {
  // Register HTTP endpoint to render /users page
  app.get('/dashboard', async function(req, res) {
    const user = await getUser(req);
    return res.render('dashboard', user);
  });

  // Register HTTP endpoint to render /users page
  app.get('/users', async function(req, res) {
    const users = await db.select(db.ref('id').withSchema('users'), 'firstName', 'lastName', 'faculty', 'role').from('se_project.users')
    .innerJoin('se_project.faculties', 'se_project.users.facultyId', 'se_project.faculties.id')
    .innerJoin('se_project.roles', 'se_project.users.roleId', 'se_project.roles.id');
    const user = await getUser(req);
    return res.render('users', { ...user, users });
  });

  // Register HTTP endpoint to render /courses page
  app.get('/courses', async function(req, res) {
    const user = await getUser(req);
    if (user.isStudent){
      const courses = await db.select('*').from('se_project.enrollments')
      .where('userId', user.userId)
      .innerJoin('se_project.courses', 'se_project.enrollments.courseId', 'se_project.courses.id')
      .innerJoin('se_project.faculties', 'se_project.courses.facultyId', 'se_project.faculties.id');
      console.log(courses);
      return res.render('courses', { ...user, courses });
    }

    const faculties = await db.select('*').from('se_project.faculties');
    const courses = await db.select(db.ref('id').withSchema('courses'), 'course', 'code', 'faculty', 'CreditHours').from('se_project.courses')
    .innerJoin('se_project.faculties', 'se_project.courses.facultyId', 'se_project.faculties.id');
     return res.render('courses', { ...user, courses, faculties});
  });
  // Register HTTP endpoint to render /enrollment page
  app.get('/enrollment', async function(req, res) {
    const user = await getUser(req);
    const enrollment = await db.select('*')
    .from('se_project.enrollments')
    .where('userId', user.userId)
    .innerJoin('se_project.users', 'se_project.enrollments.userId', 'se_project.users.id')
    .innerJoin('se_project.courses', 'se_project.enrollments.courseId', 'se_project.courses.id')
    .innerJoin('se_project.faculties', 'se_project.users.facultyId', 'se_project.faculties.id');
    const courses = await db.select('*')
    .from('se_project.enrollments')
    .where('userId', user.userId)
    .andWhereNot('grade', 0)
    .andWhere('active', 'true')
    .innerJoin('se_project.courses', 'se_project.enrollments.courseId', 'se_project.courses.id');
    let appear = true;
    if(courses.length==1|| courses.length>1){
      appear = true;
    }
    else{
      appear = false;
    }
      var totalCreditHours = 0;
      var x=0;
      var z=0;
      var y=0;
      for(let i = 0; i < courses.length; i++){
        let  grade = courses.grade;
        let CreditHours= courses.CreditHours;
        if (grade <49.9) x=5.0;
        else if (grade < 54.9) x=4.0;
        else if (grade < 59.9) x=3.7;
        else if (grade < 64.9) x=3.3;
        else if (grade < 69.9) x=3.0;
        else if (grade < 73.9) x=2.7;
        else if (grade < 77.9) x=2.3;
        else if (grade < 81.9) x=2.0;
        else if (grade < 85.9) x=1.7;
        else if (grade < 89.9) x=1.3;
        else if (grade < 93.9) x=1.0;
        else if (grade < 100) x=0.7;
        y=x*courses[i].CreditHours;
        z=z+y
        totalCreditHours += courses[i].CreditHours;
        console.log(grade);  
      }
      var finalGPA = (z/totalCreditHours);
      //console.log(finalGPA);
    return res.render('enrollment', { ...user, enrollment ,courses, finalGPA, appear});
  });
  // Register HTTP endpoint to render /users/add page
  app.get('/users/add', async function(req, res) {
    const user = await getUser(req);
    if(!user.isAdmin) {
      return res.status(301).redirect('/dashboard'); 
    }
    const faculties = await db.select('*').from('se_project.faculties');
    return res.render('add-user', { faculties });
  });
  app.get('/mangeGrades', async function(req, res) {
    const enrollment = await db.select(db.ref('id').withSchema('users'), 'enrollment_id', 'firstName', 'lastName', 'code', 'grade', 'grade_letter')
    .from('se_project.enrollments')
    .innerJoin('se_project.users', 'se_project.enrollments.userId', 'se_project.users.id')
    .innerJoin('se_project.courses', 'se_project.enrollments.courseId', 'se_project.courses.id');
    //console.log(enrollment);
    const courses = await db.select('*').from('se_project.courses');
    return res.render('mange-grades', { courses, enrollment });
  });
  app.get('/managerequest', async function(req, res) {
    const Transfer = await db.select(db.ref('id').withSchema('Transfer_requests'), 'firstName', 'lastName', 'faculty', 'newFacultyId', 'status')
      .from('se_project.Transfer_requests')
      .where('status', "pending")
      .innerJoin('se_project.faculties', 'se_project.Transfer_requests.currentFacultyId','se_project.faculties.id')
      .innerJoin('se_project.users', 'se_project.Transfer_requests.userId', 'se_project.users.id')
     
    return res.render('mange-transfer',{Transfer});
  });
  app.get('/Transferrequest', async function(req, res) {
    const faculties = await db.select('*').from('se_project.faculties');
    return res.render('transefer-request', { faculties });
  });
};
